const helpers = require("./helper.core.js")
const Base = require("./base.js")
const request = require('request');
const low =  require('lowdb');
const FileSync = require('lowdb/adapters/FileSync')
const fs = require('fs');
var path = require('path');

const download_adapter = new FileSync('download_db.json')
const download_pos_adapter = new FileSync('download_pos_db.json')
const download_db = low(download_adapter);
const download_pos_db = low(download_pos_adapter);
if(!download_db.has('item_download').value()){
  download_db.defaults({item_download:[]}).write();
}
if(!download_pos_db.has('item_download_pos').value()){
  download_pos_db.defaults({item_download_pos:[]}).write();
}
var dirpath = path.join(__dirname, "download");
const load_thread_num = 5;
const max_deep = 20;
function get_now_timestamp(){
  return Date.now();
}
function scale_size(get_size){
  var bit = 'B';
  var _size = get_size;
  if(_size>1024){
    _size = Math.round((_size/1024) * 10)/10;
    bit = 'K';
  }
  if(_size>1024){
   _size = Math.round((_size/1024) * 10)/10;
   bit = 'M';
  }
  return _size + bit;
}

function build_percentage(part_val, total){
  return Math.round((part_val/total) * 10000)/100;
}
var looper = helpers.looper;
var running_streams = {};
var is_running = false;
var FileLoader = Base.extend({
	query_file_head:function(url, callback){
		var ithis = this;
	  this.query_file_head_running = true;
	  headers = {"User-Agent": "pan.baidu.com"}
	  var options = {
	    method: 'HEAD',
	    url: url,
	    followRedirect: false,
	    followOriginalHttpMethod: true,
	    timeout: 120000,
	    strictSSL: false,
	    headers: headers
	  };
	  request(options, function(error, response, body){
	    if (!error && response.statusCode < 400){
	      var _headers = response.headers;
	      var content_type = _headers['content-type'];
	      var content_length = _headers['content-length'];
	      if(content_length){
	        content_length = parseInt(content_length);
	      }
	      var content_md5 = _headers['content-md5'];
	      var accept_ranges = _headers['accept-ranges'];
	      var location = _headers['location'];
	      if(!location){
	        location = _headers['content-location'];
	      }
	      if(location){
	        console.log('url     :', url);
	        console.log('location:', location);
	        console.log('query_redirect_deep:', ithis.query_redirect_deep);
	        if(url != location){
	          console.log('它们不同!');
	          if(ithis.query_redirect_deep < max_deep){
	            ithis.query_redirect_deep = ithis.query_redirect_deep + 1;
	            ithis.query_file_head(location, callback);
	          }
	        }
	      }
	      if(content_length && content_length>0 && !location){
	        console.log('find real url:', url);
	        callback(url, {type:content_type, length:content_length, md5:content_md5, ranges:accept_ranges})
	      } else {

	      }
	      console.log("query_file_head response content_length:", content_length);
	      console.log("query_file_head location:", location);
	      console.log("query_file_head statusCode:", response.statusCode);
	      // console.log("query_file_head _headers:", _headers);
	      // console.log("query_file_head body:", body);
	    } else {
	      console.log("query_file_head fail:", error, response);
		  callback(null, {info:"下载请求超时,请重新尝试!"})
	    }
	    ithis.query_file_head_running = false;
	  });
	},
	emit_loader_thread:function(url, params){
		var fn = params['id'];
		var start = params['start'];
		var end = params['end'];
		var pos = params['pos'];
		headers = {"User-Agent": "pan.baidu.com",
		          "Range": "bytes="+(start+pos)+"-"+(end-1)}
		var file_path = path.join(dirpath, fn);
		var stream = fs.createWriteStream(file_path);
		stream.on('drain', function(e){
		  params['drain'] = get_now_timestamp();
		  return true;
		});
		
		var options = {
		  method: 'GET',
		  url: url,
		  timeout: 120000,
		  strictSSL: false,
		  headers: headers
		};
		running_streams[fn] = stream;
		request(options).pipe(stream).on("close", function(err){
		  console.log("文件["+fn+"]下载完成!");
		  params['over'] = 1;
		  params['tm'] = get_now_timestamp();
		  delete running_streams[fn];
		}).on("error", function(){
		  console.log("文件["+fn+"]下载失败!");
		  params['over'] = 1;
		  params['tm'] = get_now_timestamp();
		  delete running_streams[fn];
		});
	},
	merge_files:function(files, final_file, callback){
	  target_fs = fs.createWriteStream(final_file);
	  var _files = JSON.parse(JSON.stringify(files));
	  function cb(){
	    if(!files.length){
	      target_fs.end("Done");
	      for(var i=0;i<_files.length;i++){
	        fs.unlinkSync(_files[i]);
	      }
	      callback("Done");
	      return;
	    }
	    stream = fs.createReadStream(files.shift());
	    stream.pipe(target_fs, {end: false});
	    stream.on("end", function(){
	      cb();
	    });
	  }
	  cb();
	},
	download:function(item, callback, sender){
		var running_task = download_db.get('item_download').find({'fs_id': item.fs_id}).value();
		if(running_task && running_task['download'] != 3){
		  this.is_loading = true;
		}
		var page_count = load_thread_num;
		var ithis = this;
		var query_file_head_callback = function(url, params){
			if(url == null && params['info']){
				this.is_loading = false;
				sender.send('asynchronous-reply', {'id': item.fs_id, 'info': params['info'], 'tag': 'download'});
				return;
			}
			var l = params['length'];
			item['total_length'] = l;
			var min_size = 1024 * 1024;
			item['download'] = 0;
			while(l/page_count < min_size && page_count>1){
			  page_count = page_count - 1;
			}
			item['tasks'] = [];
			var page_size = Math.round(l/page_count);
			
			var i = 0;
			for(i=0;i<page_count-1;i++){
			  var task_params = {'id':item.fs_id+'_'+i, 'start':i*page_size, 'end':(i+1)*page_size, 'over':0, 'pos':0, 'retry':0};
			  item['tasks'].push(task_params);
			}
			var last_task_params = {'id':item.fs_id+'_'+i, 'start':i*page_size, 'end':l, 'over':0, 'pos':0, 'retry':0};
			item['tasks'].push(last_task_params);
			
			ithis.start_loader(url, item, sender);
		};
		if(! this.is_loading && !this.query_file_head_running){
			var dl_url = null;
			if(item.dlink_tokens){
				for(var n=0;n<item.dlink_tokens.length;n++){
					tk = item.dlink_tokens[n];
					dl_url = item.dlink + "&access_token="+tk;
					break;
				}
				if(dl_url){
					this.query_file_head(item.dlink, query_file_head_callback);
				}
			}
		}else{
			console.log('loader thread is running, wait a moment!');
			sender.send('asynchronous-reply', {'id': item.fs_id, 'info': 'loader thread is running, wait a moment!', 'tag': 'download'});
		}
	},
	start_loader:function(url, item, sender){
		var ithis = this;
		var task_map = {};
		for(var k=0;k<item['tasks'].length;k++){
			var task = item['tasks'][k];
		  ithis.emit_loader_thread(url, item['tasks'][k]);
		  task_map[task['id']] = task;
		}
		var last_get_size = 0
		var max_counter = 8;
		var min_counter = 3;
		var max_retry = 20;
		var counter = 0;
		var speed = '?K';
		var exhaust = '?S';
		var total_seconds = 0;
		var load_timeout = 5*60*1000;
		var looper_listener = function(p){
		  // console.log("total:"+p.total, p.tasks);
		  var all_sub_files = [];
		  var get_size = 0;
		  var overs = [];
		  var all_over = true;
		  var new_tasks = [];
		  for(var i=0;i<p.tasks.length;i++){
		    var task = p.tasks[i];
		    var fn = task['id'];
		    var sec_total = task['end'] - task['start'];
		    var file_path = path.join(dirpath, fn);
		    all_sub_files.push(file_path);
		    var parent = task['parent'];
		    var retry = task['retry'];
		    if(fs.existsSync(file_path)){
		      var states = fs.statSync(file_path);
		      get_size = get_size+states.size;
		      // overs[i] = task['over'];
		      overs[i] = build_percentage(states.size, sec_total)+"%";
		      if(overs[i] == 1 && (states.size==0 || states.size<sec_total)){
		          console.log("size wrong:", states.size, sec_total);
		          if(!parent){
		            parent = task['id'];
		          }
		          var pos = states.size;
		          if(task_map[parent].retry < max_retry){
		            task_map[parent].retry = task_map[parent].retry + 1;
		            if(states.size>0){
		              new_tasks.push({'id':task['id']+'_'+pos, 'start':task['start']+pos, 'end':task['end'], 'over':0, 'pos':0, 'parent':parent});
		              task['end'] = task['start']+pos;
		            } else {
		              task['over'] = 0;
		              ithis.emit_loader_thread(url, task);
		            }
		          } else {
		            console.log("loading retry timeout["+parent+"]!");
		            if(running_streams[fn]){
		              running_streams[fn].end();
		            }
		          }
		      }
		    }
		    if(task['drain'] && get_now_timestamp() - task['drain'] > load_timeout){
		      console.log("loading timeout["+fn+"]!");
		      if(running_streams[fn]){
		        running_streams[fn].end("Done");
		      }
		    }
		    if(!task['over'] || task['over']==0){
		      all_over=false;
		    }
		  }
		  if(new_tasks.length>0){
		    all_over=false;
		    for(var k=0;k<new_tasks.length;k++){
		      p.tasks.push(new_tasks[k]);
		      ithis.emit_loader_thread(url, new_tasks[k]);
		    }
		  }
		  var r = build_percentage(get_size, p.total);
		  if(last_get_size == 0){
		    last_get_size = get_size;
		  }else{
		    total_seconds = total_seconds + 1;
		    counter = counter + 1;
		    if(counter >= max_counter){
		      last_get_size = get_size;
		      counter = 0;
		    }else if(get_size>last_get_size){
		      if(counter >= min_counter){
				  var real_speed = (get_size-last_get_size)/counter;
				  if(real_speed>0){
					  exhaust = Math.round((p.total-get_size)/real_speed) + 'S';
				  }
		        speed = scale_size(real_speed);  
		      }
		    }
		  }
		  // console.log("已经下载:"+r+"%,速率:"+speed, overs);
		  sender.send('asynchronous-reply', {'id': item.fs_id, 'info': "已经下载:"+r+"%,平均速率:"+speed+",已耗时:"+total_seconds+"S,约需耗时:"+exhaust+","+overs.join(' '), 'tag': 'download'});
		  if(all_over){
		    final_file = path.join(dirpath , item.filename);
		
		    ithis.merge_files(all_sub_files, final_file, function(info){
		      console.log("合并完成!");
		      this.is_loading = false;
		    });
		    return true;
		  }else{
		    return false;
		  }
		};
		looper.start();
		looper.addListener(item.fs_id, looper_listener, {tasks:item['tasks'], total:item['total_length']});
	},
	constructor:function(sender){
		this.sender = sender;
		this.is_loading = false;
		this.query_file_head_running = false;
		this.query_redirect_deep = 0;
	},
	start_thread:function(params){
		if(is_running){
			return;
		} else {
			is_running = true;
		}

		
	},
	shutdown:function(){
		is_running = false;
		looper.stop();
	}
});

module.exports = FileLoader;

