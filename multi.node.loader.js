const {webContents, dialog} = require('electron')
const helpers = require("./helper.core.js")
const show_alert = require("./show_alert.js")
var crypto = require('crypto');
const Base = require("./base.js")
const Dao = require('./dao.js')
const request = require('request');
const low =  require('lowdb');
const os =  require('os');
const FileSync = require('lowdb/adapters/FileSync')
const fs = require('fs');
var path = require('path');
const skip_size = 2048;
const POINT = helpers.point;
var base_dir = os.homedir();
var data_dir = path.join(base_dir, "._datas");
var download_loader_db = new Dao({'path': path.join(data_dir, "loader"), 'type':'list', 'name':'loader', 
'fields':[{name:"id", type:'VARCHAR', len:20},
	{name:"created_at", type:'CHAR', len:19},
	{name:"updated_at", type:'CHAR', len:19},
	{name:"fs_id", type:'VARCHAR', len:20},
	{name:"share_log_id", type:'INT'},
	{name:"path", type:'VARCHAR', len:1024},
	{name:"size", type:'INT'},
	{name:"category", type:'INT'},
	{name:"md5_val", type:'VARCHAR', len:64},
	{name:"pin", type:'INT'},
	{name:"dlink", type:'VARCHAR', len:1024},
	{name:"filename", type:'VARCHAR', len:512},
	{name:"expired_at", type:'CHAR', len:19},
	{name:"pan_account_id", type:'INT'},
	{name:"transfer_log_id", type:'INT'},
	{name:"source_id", type:'VARCHAR', len:20},
	{name:"used", type:'INT'}
	]
});
var download_task_db = new Dao({'path': path.join(data_dir, "tasks"), 'type':'list', 'name':'tasks',
'fields':[{name:"id", type:'VARCHAR', len:20},
	{name:"item_id", type:'INT'},
	{name:"md5_val", type:'VARCHAR', len:64},
	{name:"state", type:'INT'},
	{name:"filename", type:'VARCHAR', len:512},
	{name:"path", type:'VARCHAR', len:1024},
	{name:"parent", type:'INT'},
	{name:"total_length", type:'INT'},
	{name:"type", type:'VARCHAR', len:10},
	{name:"tm", type:'INT'}
	]
});
var download_sub_task_db = new Dao({'path': path.join(data_dir, "subtasks"), 'type':'list', 'name':'subtasks',
'fields':[{name:"id", type:'VARCHAR', len:40},
	{name:"source_id", type:'VARCHAR', len:20},
	{name:"start", type:'INT'},
	{name:"end", type:'INT'},
	{name:"over", type:'INT'},
	{name:"idx", type:'INT'},
	{name:"loader_id", type:'VARCHAR', len:20},
	{name:"state", type:'INT'},
	{name:"get_size", type:'INT'},
	{name:"exhaust", type:'VARCHAR', len:10},
	{name:"speed", type:'VARCHAR', len:10},
	{name:"drain", type:'INT'},
	{name:"tm", type:'INT'}
	]
});
var item_dao = new Dao({'path': path.join(data_dir, "item_cache"), 'type':'list', 'name':'item_cache',
'fields':[{name:"id", type:'INT'},
	{name:"created_at", type:'CHAR', len:19},
	{name:"updated_at", type:'CHAR', len:19},
	{name:"category", type:'INT'},
	{name:"isdir", type:'INT'},
	{name:"filename", type:'VARCHAR', len:512},
	{name:"dlink", type:'VARCHAR', len:1024},
	{name:"fs_id", type:'VARCHAR', len:20},
	{name:"path", type:'VARCHAR', len:1024},
	{name:"size", type:'INT'},
	{name:"md5_val", type:'VARCHAR', len:64},
	{name:"parent", type:'INT'},
	{name:"dlink_updated_at", type:'CHAR', len:19},
	{name:"pin", type:'INT'},
	{name:"server_ctime", type:'INT'},
	{name:"account_id", type:'INT'},
	{name:"type", type:'VARCHAR', len:10},
	{name:"t", type:'INT'}
	]
});

var download_path = path.join(base_dir, "._download");
// var dirpath = path.join('./', "download");
if(!fs.existsSync(download_path)){
  fs.mkdirSync(download_path);
  console.log('['+download_path+']dir make success!');
}else{
  console.log('['+download_path+']dir exist!');
}
// const section_max_size = 16 * 1024 * 1024;
const section_max_size = 6 * 1024 * 1024;
const section_min_size = 2* 1024 * 1024;
const load_thread_num = 5;
const max_idle_cnt = 30;
const max_deep = 20;
const max_counter = 8;
const min_counter = 3;
function get_now_timestamp(){
  return Date.now();
}
function scale_size(get_size){
  var bit = 'B';
  var _size = get_size;
  if(_size>1024){
    _size = Math.round((_size/1024) * 10)/10;
    bit = 'K';
  } else {
	_size = Math.round(_size * 10)/10;
  }
  if(_size>1024){
   _size = Math.round((_size/1024) * 10)/10;
   bit = 'M';
  }
  return _size + bit;
}
function put_to_cache(id, item){
  // file_detail_cache[id]={t: get_now_timestamp(), item: item}
  id = parseInt(id);
  item['t'] = get_now_timestamp();
  // console.log("push item to db:", item);
  // db.get('item_cache').remove({'id': id}).write();
  item_dao.get('id',id,(_item)=>{
  	if(_item){
  		item_dao.update_by_id(id, item)
  	}else{
  		item_dao.put(item);
  	}
  });
  // _item = db.get('item_cache').push(item).write()
}
function get_from_cache(id, cb){
  id = parseInt(id);
  // console.log('get_from_cache id:', id);
  _item = item_dao.get('id', id, (_item)=>{
	  if(_item){
		  // console.log('cache:', _item);
	    if(get_now_timestamp()-_item.t>1*60*60*1000){
	      // db.get('item_cache').remove({'id': id}).write();
	  	  item_dao.del('id', id, ()=>{
			  cb(null);
		  });
	    }
	  	console.log('cache hit!');
	    // return _item
		cb(_item);
	  }else{
		  cb(null);
	  }
  });
  
}
function build_percentage(part_val, total){
  return Math.round((part_val/total) * 10000)/100;
}
function query_file_info(token, item_id, callback){
	tk = token;
	item = get_from_cache(item_id, (item)=>{
		if(item){
			console.log('cache item:', item.id, ',filename:',item.filename, ',fs_id:', item.fs_id);
			callback({'id': parseInt(item_id), 'item': item});
			return;
		}else{
			fetch_by_req();
		}
	})
	function fetch_by_req(){
		headers = {"SURI-TOKEN": tk, "Content-Type": "application/x-www-form-urlencoded"};
		var options = {
			method: 'GET',
			url: POINT+'source/finfo?id='+item_id,
			followRedirect: false,
			followOriginalHttpMethod: true,
			timeout: 40000,
			strictSSL: false,
			headers: headers
		};
		request(options, function (error, response, body) {
		  if (!error && response.statusCode == 200) {
		    body = JSON.parse(body)
			var st = helpers.check_json_result(body, (state)=>{
				callback({'error': '用户状态已过期,需要重新登录!' , 'state': state})
				var current_webContents = webContents.getFocusedWebContents();
				if(current_webContents){
					current_webContents.executeJavaScript('confirm("用户状态已过期,是否重新登录?")').then((result)=>{
						// console.log('did-finish-load result:', result);
						if(result){
							relogin();
						}
					});
				}
				return;
			});
		    if(st==1 && body.hasOwnProperty('item')){
		      item = body['item'];
		      put_to_cache(parseInt(item_id), item);
		      callback({'id': parseInt(item_id), 'item': item})
		    }
		  }
		});
	}
}
var looper = helpers.looper;

var is_running = false;

function call_pansite_by_post(tk, point, _path, params, callback){
	var ithis = this;
	
	this.query_file_head_running = true;
	headers = {"SURI-TOKEN": tk, "Content-Type": "application/x-www-form-urlencoded"};
	var data = JSON.stringify(params);
	// console.log("call_pansite_by_post params:", params);
	var options = {
		method: 'POST',
		url: point + _path,
		followRedirect: false,
		followOriginalHttpMethod: true,
		timeout: 120000,
		strictSSL: false,
		form: params,
		headers: headers
	};
	request(options, function(error, response, body){
		// console.log("body:", body)
		var json_obj = JSON.parse(body);
		if(!json_obj){
			callback({"state": -1, "msg":"ready fail!"})
			return;
		}
		callback(json_obj)
	})
}
const tasker_retry_max = 3;
var Tasker = Base.extend({
	constructor:function(loader_context, params, state_change){
		this.loader_context = loader_context;
		this.params = params;
		this.state_change = state_change;
		this.last_get_size = 0;
		this.counter = 0;
		this.retry = 0;
	},
	get_state:function(){
		return this.params['state'];
	},
	verify_file:function(cb){
		var self = this;
		var r_f_size = self.fs_file_size();
		if(r_f_size && r_f_size>0){
			var skip_size = r_f_size - self.size();
			if(skip_size > 0){
				var fn = self.params.id;
				var file_path = path.join(self.loader_context.download_file_path, fn);
				if(fs.existsSync(file_path)){
					var n_file_path = path.join(self.loader_context.download_file_path, fn + '_bak');
					helpers.file_rename(file_path, n_file_path, null, ()=>{
						console.log('skip size:', skip_size, fn);
						helpers.copy_files_skip_size([n_file_path], file_path, skip_size, ()=>{
							if(cb){
								cb(true);
							}
							fs.unlinkSync(n_file_path);
						});
					});
				}
			} else {
				if(cb){
					cb(false);
				}
			}
		} else {
			if(cb){
				cb(false);
			}
		}
	},
	update_state:function(state, cb){
		var ithis = this;
		this.params['state'] = state;
		download_sub_task_db.update_by_id(this.params['id'], {'state': state}, (_id, _params)=>{
			if(ithis.state_change){
				ithis.state_change();
			}
			if(cb){
				cb();
			}
		});
		
	},
	update_pos:function(start, end, cb){
		this.params['start'] = start;
		this.params['end'] = end;
		download_sub_task_db.update_by_id(this.params['id'], {'start': start, 'end': end},(_id,_params)=>{
			if(cb){
				cb();
			}
		});
	},
	del:function(cb){
		var ithis = this;
		download_sub_task_db.del('id',this.params['id'], ()=>{
			console.log("sub task ["+ithis.params['id']+"] del ok!");
			if(cb){
				cb();
			}
		});
	},
	size:function(){
		return this.params.end-this.params.start;
	},
	save:function(cb){
		var ithis = this;
		// download_sub_task_db.del('id',this.params['id'])
		console.log("sub task will save:", this.params['id']);
		download_sub_task_db.get('id',this.params['id'],(_task)=>{
			if(_task){
				download_sub_task_db.update_by_id(ithis.params['id'], ithis.params, cb);
			} else {
				download_sub_task_db.put(ithis.params, cb);
			}
		});
	},
	cache_file_exist:function(){
		var fn = this.params.id;
		var file_path = path.join(this.loader_context.download_file_path, fn);
		if(fs.existsSync(file_path)){
			var states = fs.statSync(file_path);
			return states.size > 0;
		} else {
			return false;
		}
	},
	fs_file_size:function(){
		var fn = this.params.id;
		var file_path = path.join(this.loader_context.download_file_path, fn);
		if(fs.existsSync(file_path)){
			var states = fs.statSync(file_path);
			return states.size;
		}
		return null;
	},
	check_file_size:function(){
		var params = this.params
		var fn = this.params.id;
		var file_path = path.join(this.loader_context.download_file_path, fn);
		// console.log('check_file_size file_path:', file_path);
		if(fs.existsSync(file_path)){
			if(this.size() == 0){
				fs.unlinkSync(file_path);
				this.last_get_size = 0;
				return 0;
			}
			var states = fs.statSync(file_path);
			if(this.size()>states.size){
				if(this.get_state() == 2){
					this.update_state(3);
				}
			} else if(this.size()<states.size){
				if(this.get_state() == 2){
					this.update_state(3);
				}
				fs.unlinkSync(file_path);
				this.last_get_size = 0;
				return 0;
			}
			if(this.last_get_size == 0){
			  this.last_get_size = states.size;
			}else{
				this.counter = this.counter + 1;
				if(this.counter >= max_counter){
				  this.last_get_size = states.size;
				  this.counter = 0;
				}else if(states.size>this.last_get_size){
				  if(this.counter >= min_counter){
					  var real_speed = (states.size-this.last_get_size)/this.counter;
					  this.params['exhaust'] = 0;
					  if(real_speed>0){
						  var exhaust = Math.round((this.size()-states.size)/real_speed) + 'S';
						  if(exhaust > 0){
							this.params['exhaust'] = exhaust;  
						  }
					  }
				    var speed = scale_size(real_speed); 
					this.params['speed'] = speed;
				  }
				}
			}
			this.params['get_size'] = states.size;
			return states.size;
		}
		this.last_get_size = 0;
		return 0;
	},
	try_close_pipe:function(){
		if(this.pipe){
			try{
				this.pipe.end();
			}catch(e){
				console.error("try_close_pipe:", e);
			}
			this.pipe = null;
			if([0,1].indexOf(this.get_state()) >=0 ) {
				this.update_state(3);
			}
		}
	},
	check_req_stream_file:function(file_path){
		if(fs.existsSync(file_path)){
			var states = fs.statSync(file_path);
			var f_size =  states.size;
			if(f_size == 0){
				return {'error_code':9999, 'error_msg':'nothing in this file['+file_path+']!'}
			}
			if(f_size < skip_size){
				var file_buffer = fs.readFileSync(file_path);
				var find_brace = false;
				var find_quota = false;
				var dog = 20;
				var pos = 0;
				while(dog>0 && (!find_brace || !find_quota) && pos < f_size){
					if([32, 10, 2, 0].indexOf(file_buffer[pos]) < 0){
						if(!find_brace){
							if(123 != file_buffer[pos]){
								break;
							} else {
								find_brace = true;
							}
						} else {
							if(34 == file_buffer[pos]){
								find_quota = true;
							}
							break;
						}
					}
					dog = dog -1;
					pos = pos + 1;
				}
				var rm_fs = function(){
					try{
						fs.unlinkSync(file_path);
					}catch(e){
						console.error(e);
					}
				};
				var jsonstr = file_buffer.toString();
				if(jsonstr.indexOf('Requested')>=0){
					error_msg = jsonstr;
					rm_fs();
					return {'error_code':9999, 'error_msg':error_msg}
				} else if(jsonstr.indexOf('<html>')>=0){
					var reg = new RegExp("<title>([^<>]*)</title>");
					var r = jsonstr.match(reg);
					error_msg = r[1];
					rm_fs();
					return {'error_code':9999, 'error_msg':error_msg}
				} else if(find_brace && find_quota){
					var json_obj = JSON.parse(jsonstr);
					if(json_obj.hasOwnProperty("request_id") && json_obj.hasOwnProperty("error_code")){
						rm_fs();
						return json_obj;
					}
				} else {
					var file_type = this.loader_context.task.type;
					if(file_type && ['txt','log'].indexOf(file_type)<0){
						if(jsonstr.indexOf('Requested')>=0){
							rm_fs();
							return {'error': jsonstr};
						}
					}
				}
				if(this.size() > f_size){
					rm_fs();
					return {'error_code':9999, 'error_msg':'datas is not enough, in this file['+file_path+']!'}
				}
			}
		}
		return null;
	},
	ready_emit_loader_thread:function(cb){
		var self = this;
		var params = this.params;
		var fn = params['id'];
		var file_path = path.join(self.loader_context.download_file_path, fn);
		if(params['loader_id'] == 0){
			console.log('下载任务参数异常,稍后重试:', params);
			self.loader_context.check_next_task(file_path);
			if(cb){
				cb();
			}
			return;
		}
		var loader = this.loader_context.cfl.get_loader_by_id(params['loader_id']);
		// console.log('ready_emit_loader_thread loader:', loader);
		// console.log('ready_emit_loader_thread sub task params:', params);
		download_loader_db.update_by_id(loader.id, {'pin': 1}, (id, params)=>{
			self.emit_loader_thread(loader);
			if(cb){
				cb();
			}
		});
	},
	recheck_loader:function(loader, cb){
		var ithis = this;
		
		if(loader.hasOwnProperty('transfer_log_id') && loader.transfer_log_id>0){
			var _path = "source/check_transfer";
			call_pansite_by_post(ithis.loader_context.token, POINT, _path, {"id": loader.transfer_log_id}, (result)=>{
				console.log("check_transfer result:", result);
				if(result && result.hasOwnProperty('dlink') && result.dlink){
					var transfer_log_id = result.id;
					var dlink = result.dlink;
					loader.dlink = dlink;
					download_loader_db.update_by_id(loader.id, {'dlink': dlink},()=>{
						if(cb){
							cb(loader);
						}
					});
				} else {
					if(cb){
						cb(loader);
					}
				}
			});
		} else if(loader.hasOwnProperty('share_log_id') && loader.share_log_id>0){
			var _path = "source/check_shared_log";
			call_pansite_by_post(ithis.loader_context.token, POINT, _path, {"id": loader.share_log_id}, (result)=>{
				console.log("check_transfer result:", result);
				if(result && result.hasOwnProperty('dlink') && result.dlink){
					var transfer_log_id = result.id;
					var dlink = result.dlink;
					loader.dlink = dlink;
					download_loader_db.update_by_id(loader.id, {'dlink': dlink},()=>{
						if(cb){
							cb(loader);
						}
					});
				} else {
					if(cb){
						cb(loader);
					}
				}
			});
		} else {
			if(cb){
				cb(loader);
			}
		}
	},
	emit_loader_thread:function(loader){
		var ithis = this;
		var params = this.params;
		if([2,7].indexOf(ithis.get_state()) >=0 ) {
			console.log('下载任务不符合下载状态:', params);
			return;
		}
		var is_patch = params.hasOwnProperty('patch')?params.patch==1:false;
		// var loader = this.loader_context.cfl.get_loader_by_id(params['loader_id']);
		var url = loader.dlink;
		var fn = params['id'];
		var start = params['start'];
		var end = params['end'];
		// var pos = params['pos'];
		headers = {"User-Agent": "pan.baidu.com",
		          "Range": "bytes="+start+"-"+(end-1)}
		var file_path = path.join(this.loader_context.download_file_path, fn);
		// console.log("file_path:", file_path, params);
		var stream = fs.createWriteStream(file_path);
		stream.on('drain', function(e){
		  params['drain'] = get_now_timestamp();
		  return true;
		});
		// console.log('url:', url, headers.Range);
		this.update_state(1);
		var options = {
		  method: 'GET',
		  url: url,
		  timeout: 50000,
		  strictSSL: false,
		  headers: headers
		};
		
		var check_rs_by_check_rs = (check_rs)=>{
			ithis.update_state(0, ()=>{
			  if(check_rs.hasOwnProperty('error_code')){
				  if(31045 == check_rs.error_code){
					  if(ithis.retry >= tasker_retry_max){
						  ithis.retry = 0;
						  download_loader_db.update_by_conditions_increment({'id':loader.id}, {'pin': 3}, {'used':-1},()=>{
							  loader.used -= 1;
							  download_sub_task_db.update_by_id(ithis.params['id'], {'loader_id':0},()=>{
								  ithis.params['loader_id'] = 0;
							  	ithis.update_state(3,()=>{
										ithis.recheck_loader(loader,()=>{
											final_call(3);
										});
										
									});
							  });
						  });
					  }
				  } else if(31626 == check_rs.error_code){
					  //check dlink,无须重试,直接等待重新分配loader
					  console.log('error_code[31626]:', check_rs);
					  download_loader_db.update_by_conditions_increment({'id':loader.id}, {'pin': 3}, {'used':-1},()=>{
						  download_sub_task_db.update_by_id(ithis.params['id'], {'loader_id':0},()=>{
							  ithis.params['loader_id'] = 0;
						  	ithis.update_state(3,()=>{
								ithis.recheck_loader(loader,()=>{
									final_call(3);
								});
								
							});
						  });
					  });
					  return;
				  } else {
					  // final_call();
				  }
				if(ithis.retry < tasker_retry_max){
				  ithis.retry += 1;
				  setTimeout(()=>{ithis.emit_loader_thread(loader);},3000);					  
				} else {
					console.log("error 文件["+fn+"]下载失败!", check_rs);
				}
			  } else {
				  // final_call();
				  console.log("error 文件["+fn+"]下载失败!", check_rs);
			  }
			});
		};
		
		this.try_close_pipe();
		try{
			var rq = request(options);
			this.pipe = rq.pipe(stream);
			this.pipe.on("close", function(){
			  console.log("文件["+fn+"] on close:");
			  params['over'] = 1;
			  params['tm'] = get_now_timestamp();
			  stream.end();
			});
			rq.on("error", function(err){
			  console.log("rq error 文件["+fn+"]下载失败!===>",err);
			  // params['over'] = 1;
			  params['tm'] = get_now_timestamp();
			  // ithis.update_state(4);
			  recover_loader_state_by_err(()=>{final_call(3)});
			}).on("timeout", function(){
				console.log("rq error 文件["+fn+"]下载超时失败!");
				// ithis.update_state(5);
				recover_loader_state_by_err(()=>{final_call(3)});
			}).on("aborted", function(){
				console.log("rq error 文件["+fn+"]下载被中断失败!");
				// ithis.update_state(5);
				recover_loader_state_by_err(()=>{final_call(3)});
			}).on("response",(res)=>{
				if(res){
					res.on('end', () => {
						console.log('文件['+fn+'] on end complete?:', res.complete);
						var check_rs = ithis.check_req_stream_file(file_path);
					    if (!res.complete){
							if(check_rs){
								check_rs_by_check_rs(check_rs);
							} else {
								recover_loader_state_by_err(()=>{final_call(3)});
							}
						} else {
							if(check_rs){
								check_rs_by_check_rs(check_rs);
							} else {
								recover_loader_state_by_success();
							}
						}
					  });
				}
			});
		}catch(e){
			params['over'] = 1;
			params['tm'] = get_now_timestamp();
			console.error("e:", e);
			try{
				stream.end();
			}catch(e0){
				console.error("e0:", e0)
			}
			recover_loader_state_by_err(()=>{final_call(3)});
		}
		var recover_loader_state_by_err = (cb)=>{
			download_loader_db.update_by_id(loader.id, {'pin': 0}, ()=>{
				ithis.update_state(3, cb);
			});
		};
		var recover_loader_state_by_success = ()=>{
			download_loader_db.update_by_conditions_increment({'id':loader.id}, {'pin': 0}, {'used':1},()=>{
				loader.used += 1;
				if(ithis.get_state() != 3 && ithis.get_state() != 2){
					ithis.update_state(2, ()=>{final_call(2);});
				} else {
					setTimeout(()=>{
						var fs_size = ithis.fs_file_size();
						if(fs_size && ithis.size() == fs_size){
							console.log('出现未知情况,状态为'+ithis.get_state()+'.但size相同,故强制状态为2,继续执行.');
							if(ithis.get_state() == 3){
								ithis.update_state(2, ()=>{final_call(2);});
							} else {
								final_call(2);
							}
						} else {
							console.log('出现未知情况,状态为:'+ithis.get_state());
							final_call(3);
						}
					}, 300);
				}
			});
		};
		var final_call = function(st){
			if(!ithis.loader_context.is_loading()){
				return;
			}
			if(is_patch){
				console.log('this is patched sub task, maybe stop here!');
				ithis.loader_context.checkout_loader_list((loader_list)=>{
					if(loader_list && loader_list.length>1){
						ithis.loader_context.check_next_task(file_path);
					} else {
						console.log('this is patched sub task, maybe stop here!');
					}
				});
				return;
			}
			if(!ithis.loader_context.check_next_task(file_path)){
				console.log('will retry final call!,', params);
				setTimeout(final_call, 1000);
			} else {
				console.log('final call, source state:', st);
			}
		};
	}
	
});
function query_tasker_list_from_local(source_id, cb){
	return tasker_list = download_sub_task_db.query('source_id', source_id, (rows)=>{
		cb(rows);
	});
}
var CrossFileLoader = Base.extend({
	constructor:function(master, item, context){
		this.master = master;
		this.item = item;
		this.context = context
		this.sender = this.context.sender;
		this.tasks = [];
		this.loaders = [];
		// console.log("CrossFileLoader constructor, item:", item)
	},
	isMaster: function(){
		return this.master?false:true;
	},
	get_loader_by_id:function(loader_id){
		for(var i=0;i<this.loaders.length;i++){
			console.log(this.loaders[i].id+"?="+loader_id+":", this.loaders[i].id==loader_id);
			if(this.loaders[i].id==loader_id){
				return this.loaders[i];
			}
		}
	},
	build_download_thread: function (datas, section_index) {
		var ithis = this;
		var loader_list=[]
		var cnt = 0;
		if(datas.hasOwnProperty("master")){
			cnt += 1;
			master = datas['master'];
			// thread_count=1;
			loader_list.push(master)
			var share_log_id = master['id'];
			master['id'] = master['fs_id'];
			master['share_log_id'] = share_log_id;
			master['source_id'] = this.context.task.id;
			master['used'] = 0;
			console.log("source_id:",master['source_id']);
			download_loader_db.get('id',master['id'],(item)=>{
				if(item){
					download_loader_db.update_by_id(master['id'], master)
				}else{
					download_loader_db.put(master);
				}
			});
			
		}
		if(datas.hasOwnProperty("subs")){
			var subs = datas['subs'];
			// thread_count += subs.length;
			cnt += 1;
			var re_call_save_loader = (pos)=>{
				if(pos>=subs.length){
					final_call();
					return;
				}
				var sub_loader = subs[pos];
				var transfer_log_id = sub_loader['id'];
				sub_loader['id'] = sub_loader['fs_id'];
				sub_loader['transfer_log_id'] = transfer_log_id;
				sub_loader['source_id'] = ithis.context.task.id;
				sub_loader['used'] = 0;
				download_loader_db.get('id',sub_loader['id'],(_item)=>{
					if(_item){
						download_loader_db.update_by_id(sub_loader['id'], sub_loader, ()=>{
							re_call_save_loader(pos+1);
						});
					}else{
						download_loader_db.put(sub_loader, ()=>{re_call_save_loader(pos+1);});
					}
				});
			};
			re_call_save_loader(0);
		}
		this.loaders = loader_list
		var final_call = ()=>{
			cnt--;
			if(cnt == 0){
				console.log("final call build_main_tasks!");
				download_loader_db.query_mult_params({'source_id':this.context.task.id, 'pin':0}, (loader_list)=>{
					ithis.loaders = loader_list;
					ithis.context.build_main_tasks();
				});
			}
		}
		// if(section_index && section_index < len(dlink_list))
		// 	dlink_list = [dlink_list[section_index]]
		//this.context.check_file_content_length(this.item, dlink_list, this.sender);
		
		
	},
	ready: function(section_index){
		var ithis = this;
		if(!this.context.task || !this.context.task.id){
			return;
		}
		download_loader_db.update_by_conditions({'source_id':this.context.task.id}, {'pin': 0}, function(){
			if(ithis.isMaster()){
				console.log('source_id:', ithis.context.task.id);
				download_loader_db.query_mult_params({'source_id':ithis.context.task.id, 'pin':0}, (loader_list)=>{
					console.log('query source_id:', ithis.context.task.id);
					console.log('query loader_list length:', loader_list.length);
					var need_rebuild_loader = false;
					if(!loader_list || loader_list.length==0){
						need_rebuild_loader = true;
					} else {
						var expired_at = new Date(loader_list[0]['expired_at']);
						console.log("expired_at time:", expired_at.getTime());
						console.log(" Date.now():", Date.now());
						if(expired_at.getTime()<Date.now()){
							need_rebuild_loader = true;
						}
						// this.context.build_main_tasks();
						// console.log('loader_list:', loader_list);
					}
					if(need_rebuild_loader){
						_path = "source/readydownload";
						call_pansite_by_post(ithis.context.token, POINT, _path, {"fs_id": ithis.item["fs_id"]}, (result)=>{
							console.log("readydownload result:", result);
							ithis.build_download_thread(result, section_index);
						});
					} else {
						ithis.loaders = loader_list;
						ithis.context.build_main_tasks();
					}
				});
			}
		});
		
	}
	
	
});
var MultiFileLoader = Base.extend({
	query_file_head:function(url, callback){
		var ithis = this;
	  this.query_file_head_running = true;
	  headers = {"User-Agent": "pan.baidu.com"}
	  var options = {
	    method: 'HEAD',
	    url: url,
	    followRedirect: false,
	    followOriginalHttpMethod: true,
	    timeout: 100000,
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
	      if(response.statusCode==302 && location){
	        console.log('url     :', url);
	        console.log('location:', location);
	        console.log('query_redirect_deep:', ithis.query_redirect_deep);
	        if(url != location){
	          console.log('diff!');
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
			console.log("statusCode:", response.statusCode, ",query head failed!");
	      // console.log("query_file_head fail:", error, response);
		  callback(null, {info:"下载请求超时,请重新尝试!"})
	    }
	    ithis.query_file_head_running = false;
	  });
	},
	check_next_task:function(key){
		if(this.check_tasks_events.indexOf(key)<0){
			this.check_tasks_events.push(key);
		}
		return true;
	},
	deal_check_tasks_events:function(callback){
		var self = this;
		if(!self.is_loading()){
			// console.log('main task have not start to load!!!');
			callback(-1);
			return;
		}
		if(!this.checking_next_task && this.check_tasks_events.length>0){
			var _events = [];
			self.idle_cnt = 0;
			this.check_tasks_events.forEach((e, idx)=>{
				_events.push(e);
			});
			_events.forEach((e, i)=>{
				var idx = this.check_tasks_events.indexOf(e);
				this.check_tasks_events.splice(idx,1);
			});
			var re_call=function(pos){
				if(pos>=_events.length){
					callback(_events.length);
					return;
				}
				self._check_next_task(()=>{
					setTimeout(()=>{re_call(pos+1);},100);
				});
			};
			re_call(0);
		} else {
			if(!self.checking_next_task){
				if(!self.idle_cnt){
					self.idle_cnt = 1;
				} else {
					self.idle_cnt += 1;
				}
				if(self.idle_cnt >= max_idle_cnt){
					self.check_next_task('retry');
				}
			}
			callback(0);
		}
	},
	_check_next_task:function(cb){
		var ithis = this;
		var self = this;
		if(this.checking_next_task){
			console.log('check_next_task return ,waiting !!!!');
			return false;
		}
		var loader_pos = 0;
		var _loader_list = [];
		var item = ithis.item;
		var patch_tasks = [];
		this.checking_next_task = true;
		console.log('check_next_task in!!!!');
		var do_patch_tasks = function(){
			if(patch_tasks.length>0){
				ithis._re_call_emit_loader_thread(patch_tasks, (used_cnt)=>{
					console.log('check_next_task, used_cnt, ld_cnt=>', used_cnt, _loader_list.length);
					self.checking_next_task = false;
					cb();
					
				});
				
			} else {
				self.checking_next_task = false;
			}
		}
		var final_call = function(comeon){
			if(comeon){
				if(loader_pos < _loader_list.length){
					var _lp = loader_pos;
					loader_pos = loader_pos + 1;
					console.log('loader pos:', _lp);
					async_re_call(0, _loader_list[_lp]);
				} else {
					do_patch_tasks();
				}
			} else {
				do_patch_tasks();
			}
		};
		
		var async_re_call = (pos, loader)=>{
			if(pos>=ithis.tasks.length){
				final_call(false);
				return;
			}
			var t = ithis.tasks[pos];
			if(t.get_state() == 7){ //处理一下 state:3中途失败的段
				console.log('find 7 state pos:', pos);
				t.params.loader_id = loader.id;
				t.params.state = 0;
				var retain_section_start = t.params.start + section_max_size;
				var retain_section_end = t.params.end;
				if(retain_section_end >= retain_section_start){
					t.params.end = retain_section_start;
				}
				t.params.loader_id = loader.id;
				
				if(retain_section_start < retain_section_end){
					var new_id = t.params.id+'_1';
					if(t.params.idx > 0){
						var id_vals = t.params.id.split('_');
						var the_last_v = id_vals[id_vals.length-1];
						the_last_v = parseInt(the_last_v) + 1;
						id_vals[id_vals.length-1] = the_last_v;
						new_id = id_vals.join('_');
					}
					var fn = new_id;
					var new_sub_file_path = path.join(self.download_file_path, fn);
					if(fs.existsSync(new_sub_file_path)){
						new_id = new_id + '_1';
					}
					var task_params = {'id':new_id, 'source_id':ithis.task.id, 'start':retain_section_start, 'end':retain_section_end, 'over':0, 'idx':1, 'retry':0, 'loader_id': 0, 'state': 7};
					item['tasks'].push(task_params);
					var task = new Tasker(ithis, task_params);
					task.save(()=>{
						t.params.end = retain_section_start;
						t.params.state = 0;
						download_sub_task_db.update_by_id(t.params.id, {'end':t.params.end, 'loader_id':t.params.loader_id, 'state': 0}, ()=>{
							ithis.tasks.push(task);
							patch_tasks.push(t);
							final_call(true);
						});
					});
				} else {
					download_sub_task_db.update_by_id(t.params.id, {'loader_id':t.params.loader_id, 'state': 0}, ()=>{
						patch_tasks.push(t);
						final_call(true);
					});
				}
				
				// console.log('t.params.start, end:', t.params.start, t.params.end);
				// console.log('retain_section_start, retain_section_end:', retain_section_start, retain_section_end);
				// console.log('will update sub task:', t.params.id, {'end':t.params.end, 'loader_id':t.params.loader_id, 'state': 0});
				// download_sub_task_db.update_by_id(t.params.id, {'end':t.params.end, 'loader_id':t.params.loader_id, 'state': 0}, ()=>{
				// 	t.params.state = 0;
				// 	if(retain_section_start < retain_section_end){
				// 		var new_id = t.params.id+'_1';
				// 		if(t.params.idx > 0){
				// 			var id_vals = t.params.id.split('_');
				// 			var the_last_v = id_vals[id_vals.length-1];
				// 			the_last_v = parseInt(the_last_v) + 1;
				// 			id_vals[id_vals.length-1] = the_last_v;
				// 			new_id = id_vals.join('_');
				// 		}
				// 		var task_params = {'id':new_id, 'source_id':ithis.task.id, 'start':retain_section_start, 'end':retain_section_end, 'over':0, 'idx':1, 'retry':0, 'loader_id': 0, 'state': 7};
				// 		item['tasks'].push(task_params);
				// 		var task = new Tasker(ithis, task_params);
				// 		task.save(()=>{
				// 			ithis.tasks.push(task);
				// 			patch_tasks.push(t);
				// 			final_call(true);
				// 		});
				// 	} else {
				// 		patch_tasks.push(t);
				// 		final_call(true);
				// 	}
				// });
			} else if(t.get_state() == 3){
				var renew_sub_task = ()=>{
					var new_id = t.params.id+'_1';
					if(t.params.idx == 2){
						var id_vals = t.params.id.split('_');
						var the_last_v = id_vals[id_vals.length-1];
						the_last_v = parseInt(the_last_v) + 1;
						id_vals[id_vals.length-1] = the_last_v;
						new_id = id_vals.join('_');
					}
					var fn = new_id;
					var new_sub_file_path = path.join(self.download_file_path, fn);
					if(fs.existsSync(new_sub_file_path)){
						new_id = new_id + '_1';
					}
					t.try_close_pipe();
					var new_start = t.params.start;
					var _sub_t_loader_id = t.params.loader_id;
					if(''+_sub_t_loader_id == '0'){
						_sub_t_loader_id = loader.id;
					}
					var task_params = {'id':new_id, 'source_id':t.params.source_id, 'start':new_start, 'end':t.params.end, 'over':0, 'idx':2, 'retry':0, 'loader_id': _sub_t_loader_id, 'state': 0, 'patch': 1};
					var _task = new Tasker(ithis, task_params);
					_task.save(()=>{
						t.update_state(2,()=>{
							t.update_pos(t.params.start, new_start, ()=>{
								ithis.del_sub_task(t, (sub_task, context)=>{
									var _idx = context.tasks.indexOf(sub_task);
									// if(_idx>=0){
									// 	context.tasks.splice(_idx,1);
									// }
									ithis.tasks.push(_task);
									patch_tasks.push(_task);
									final_call(true);
								});
							});
						});
						
					});
				};
				renew_sub_task();
				// var file_real_size = t.fs_file_size();
				// if(file_real_size && file_real_size>0 && file_real_size < skip_size){
				// 	t.update_state(0,()=>{
				// 		fs.unlinkSync(file_path);
				// 		patch_tasks.push(t);
				// 		final_call(true);
				// 	});
				// } else if(file_real_size && t.size() >= file_real_size){
				// 	renew_sub_task();
				// } else {
				// 	t.update_state(0,()=>{
				// 		patch_tasks.push(t);
				// 		final_call(true);
				// 	});
				// }
			}else {
				async_re_call(pos + 1, loader);
			}
		}
		
		// download_loader_db.query_mult_params({'source_id':self.task.id, 'pin':0}, (loader_list)=>{
		// 	// var page_count = loader_list.length;
		// 	// if(page_count>0){
		// 	// 	async_re_call(0, loader_list[0]);
		// 	// }
		// 	_loader_list = loader_list;
		// 	console.log('_loader_list len:', _loader_list.length);
		// 	final_call(true);
			
		// });
		self.checkout_loader_list((loader_list)=>{
			_loader_list = loader_list;
			console.log('_loader_list len:', _loader_list.length);
			final_call(true);
		});
		
		return true;
	},
	checkout_loader_list:function(cb){
		var self = this;
		download_loader_db.query_mult_params({'source_id':self.task.id, 'pin':0}, (loader_list)=>{
			if(cb){
				cb(loader_list);
			}
		}, 50, 0, 'order by used desc');
	},
	build_main_tasks:function(){
		var ithis = this;
		var item = ithis.item;
		var loader_list = this.cfl.loaders;
		var page_count = loader_list.length;
		if(page_count==0){
			console.log('没有可用的loader!');
			return;
		}
		if(this.task.state != 0){
			var files = fs.readdirSync(this.download_file_path)
			console.log();
			if(files.length>0){
				page_count = files.length;
			}
		}
		console.log("page_count:", page_count);
		query_tasker_list_from_local(this.task.id, (task_param_list)=>{
			ithis.pause();
			
			ithis.tasks = [];
			task_param_list.forEach((p)=>{
				console.log('task:', p.id, ',end:', p.end, ',state:',p.state);
				ithis.tasks.push(new Tasker(ithis, p));
			});
			if(!ithis.tasks || ithis.tasks.length==0){
				ithis.query_file_head(loader_list[0]['dlink'], query_file_head_callback);
			}else{
				ithis.start_tasker(()=>{
				//show dialog
				console.log('send show_dialog!!!!');
				ithis.sender.send('asynchronous-reply', {'id': item.fs_id, 'tag': 'show_dialog'});
			});
			}
		});
		
		var query_file_head_callback = function(url, params){
			if(url == null && params['info']){
				ithis.sender.send('asynchronous-reply', {'id': item.fs_id, 'info': params['info'], 'tag': 'download'});
				return;
			}
			var l = params['length'];
			ithis.update_task('total_length', l);
			item['total_length'] = l;
			item['download'] = 0;
			while(page_count>1 && l/page_count < section_min_size){
			  page_count = page_count - 1;
			}
			item['tasks'] = [];
			var page_size = Math.round(l/page_count);
			if(page_size > section_max_size){
				page_size = section_max_size;
			}
			var i = 0;
			var loader_index = i;
			for(i=0;i<page_count-1;i++){
				loader_index = i;
				if(loader_index>loader_list.length){
					loader_index = loader_list.length - 1;
				}
				var loader = loader_list[loader_index];
			  var task_params = {'id':ithis.task.id+'_'+i, 'idx':0, 'source_id':ithis.task.id, 'start':i*page_size, 'end':(i+1)*page_size, 'over':0, 'retry':0, 'loader_id': loader.id, 'state': 0};
			  item['tasks'].push(task_params);
			  var task = new Tasker(ithis, task_params);
			  task.save();
			  ithis.tasks.push(task);
			}
			loader_index = i;
			if(loader_index>loader_list.length){
				loader_index = loader_list.length - 1;
			}
			var the_last_start = i*page_size;
			var last_task_params = {'id':ithis.task.id+'_'+i, 'idx':0, 'source_id':ithis.task.id, 'start':the_last_start, 'end':l, 'over':0, 'retry':0, 'loader_id': loader_list[loader_index].id, 'state': 0};
			if(l - the_last_start > section_max_size){
				last_task_params = {'id':ithis.task.id+'_'+i, 'idx':0, 'source_id':ithis.task.id, 'start':the_last_start, 'end':the_last_start + section_max_size, 'over':0, 'retry':0, 'loader_id': loader_list[loader_index].id, 'state': 0};
			}
			item['tasks'].push(last_task_params);
			var task = new Tasker(ithis, last_task_params);
			task.save();
			ithis.tasks.push(task);
			if(l - the_last_start > section_max_size){
				var retain_section_start = the_last_start + section_max_size;
				var retain_task_params = {'id':ithis.task.id+'_'+(i + 1), 'idx':0, 'source_id':ithis.task.id, 'start':retain_section_start, 'end':l, 'over':0, 'retry':0, 'loader_id': 0, 'state': 7};
				item['tasks'].push(retain_task_params);
				var task = new Tasker(ithis, retain_task_params);
				task.save();
				ithis.tasks.push(task);
			}
			//ithis.start_loader(item, sender);
			ithis.start_tasker(()=>{
				//show dialog
				console.log('send show_dialog!!!!');
				ithis.sender.send('asynchronous-reply', {'id': item.fs_id, 'info': params['info'], 'tag': 'show_dialog'});
			});
		};
		
		
	},
	download:function(emit_tag){
		this.save_task_params();
		
		this.emit_tag = emit_tag;
		var item = this.item
		if(!this.cfl){
			this.cfl = new CrossFileLoader(null, item, this);
		}
		this.cfl.ready();
	},
	pause:function(){
		var ithis = this;
		if(ithis.tasks && ithis.tasks.length>0){
			ithis.tasks.forEach((t,idx)=>{
				t.try_close_pipe();
			});
		}
		this.update_state(3);
	},
	redownload:function(section_index, account, item, callback, sender){
	},
	bind_listener:function(){
		var ithis = this;
		var total_length = ithis.get_total_length();
		var last_get_size = 0
		var max_retry = 20;
		var counter = 0;
		var speed = '?K';
		var exhaust = '?S';
		var total_seconds = 0;
		// var load_timeout = 5*60*1000;
		var dirty = false;
		var looper_listener = function(p){
			var total_size = total_length;
			var total_file_size = ithis.get_download_size();
			var complete_total_file_size = ithis.get_download_complete_size();
			// console.log("total_size,total_file_size:", total_size, total_file_size);
			var all_over = complete_total_file_size == total_length;
			all_over = complete_total_file_size >= total_length;
			// console.log("total_size:", total_size);
			// console.log("total_file_size:", total_file_size);
			var r = build_percentage(total_file_size, total_length);
			if(last_get_size == 0){
			  last_get_size = total_file_size;
			}else{
			  total_seconds = total_seconds + 1;
			  counter = counter + 1;
			  if(counter >= max_counter){
			    last_get_size = total_file_size;
			    counter = 0;
			  }else if(total_file_size>=last_get_size){
			    if(counter >= min_counter){
							  var real_speed = (total_file_size-last_get_size)/counter;
							  if(real_speed>0){
								  exhaust = Math.round((p.total-total_file_size)/real_speed) + 'S';
							  }
			      speed = scale_size(real_speed);  
			    }
			  }
			}
			
			ithis.sender.send('asynchronous-reply', {'id': ithis.task.id, 'over':all_over, 'info': "已经下载:"+r+"%,平均速率:"+speed+",已耗时:"+total_seconds+"S,约需耗时:"+exhaust, 'tag': 'progress'});
			var sub_task_params = [];
			if(ithis.is_loading()) {
				ithis.tasks.forEach((t, index)=>{
					if(t.params.state!=7){
						sub_task_params.push(t.params);
					}
				});
			}
			
			if(all_over){
			  ithis.merge_final_file(()=>{
				  ithis.sender.send('asynchronous-reply', {'id': ithis.task.id, 'over':all_over, 'task': ithis.task, 'tag':'sub_tasks', 'tasks_params':sub_task_params, 'total_length': total_length, 'total_file_size':total_file_size, "speed": speed, "need": exhaust});
			  });
			  return true;
			}else{
			  ithis.deal_check_tasks_events((cnt)=>{if(cnt>0)console.log('deal cnt:', cnt)});
			  if(ithis.is_ready){
				  ithis.sender.send('asynchronous-reply', {'id': ithis.task.id, 'over':all_over, 'task': ithis.task, 'tag':'sub_tasks', 'tasks_params':sub_task_params, 'total_length': total_length, 'total_file_size':total_file_size, "speed": speed, "need": exhaust});
			  }
			  return false;
			}
		};
		looper.addListener(ithis.task.id, looper_listener, {context:this, total:total_length});
	},
	merge_final_file(final_cb){
		var ithis = this;
		var final_file = path.join(ithis.download_file_path , ithis.task.filename);
		this.tasks.sort(function(task_a, task_b){
			return task_a.params["start"] - task_b.params["start"];
		});
		var all_sub_files = []
		this.tasks.forEach(function(t, index){
			var fn = t.params.id;
			var file_path = path.join(ithis.download_file_path, fn);
			if(t.check_file_size()>0){
				all_sub_files.push(file_path);
			}
		});
		if(all_sub_files.length>0){
			setTimeout(()=>{
				helpers.append_merge_files(all_sub_files, final_file, function(info){
				  console.log("合并完成!");
				  console.log("md5:",ithis.task.md5_val);
				  console.log("final_file:",final_file);
				  const input = fs.createReadStream(final_file);
				  var md5 = crypto.createHash('md5');
				  input.on('data', (chunk)=>{md5.update(chunk);}).on('end', ()=>{
					  var filemd5 = md5.digest('hex');
					  console.log(filemd5);
					  if(ithis.task.md5_val == filemd5){
						  console.log("成功!清除辅助文件...");
						  // ithis.complete();
					  } else {
						  console.log("MD5比对失败!清除辅助文件...");
					  }
					  ithis.complete(()=>{
						  if(final_cb)final_cb();
					  });
					});
				});
			}, 1000);
		} else {
			if(final_cb)final_cb();
		}
	},
	_re_call_emit_loader_thread: function(subtasks, fc){
		var self = this;
		var used_cnt = 0;
		var re_call = function(pos){
			// console.log('_re_call_emit_loader_thread pos:',pos);
			if(pos>=subtasks.length){
				fc(used_cnt);
				return;
			}
			var t = subtasks[pos];
			console.log('sub task:', t.params.id, ',st:', t.params.state);
			if(t.params.state == 0){
				used_cnt = used_cnt + 1;
				t.ready_emit_loader_thread(()=>{
					re_call(pos + 1);
				});
			} else if(t.params.state == 7){
				re_call(pos + 1);
			} else {
				re_call(pos + 1);
			}
		};
		re_call(0);
	},
	emit_tasks:function(cb){
		var ithis = this;
		var ld_cnt = ithis.cfl.loaders.length;
		var final_call = function(used_cnt){
			console.log('emit_tasks, used_cnt, ld_cnt=>', used_cnt, ld_cnt);
			if(used_cnt==0 || used_cnt < ld_cnt){
				ithis.check_next_task('init');
			}
			ithis.bind_listener();
			if(cb)cb();
		};
		this._re_call_emit_loader_thread(this.tasks, final_call);
	},
	ready_emit_tasks:function(cb){
		console.log("ready_emit_tasks in.emit_tag:", this.emit_tag);
		var self = this;
		if(this.emit_tag){
			if(typeof(this.emit_tag) == "function"){
				if(this.emit_tag()){
					this.update_state(1,()=>{
						self.emit_tasks(cb);
					});
				}
			} else {
				this.update_state(1,()=>{
					self.emit_tasks(cb);
				});
			}
		} else {
			if(cb)cb();
		}
		self.is_ready = true;
		MultiFileLoader.instance_map[this.task.id] = this;
		this.sender.send('asynchronous-reply', {'tag': 'synctasks', 'tasks': MultiFileLoader.instance_map})
	},
	re_build_sub_tasks:function(){
		var ithis = this;
		var loader_list = this.cfl.loaders;
		var page_count = loader_list.length;
		var will_del = [];
		var retain_tasks = [];
		var will_re_build = [];
		this.tasks.forEach(function(t, index){
			if(t.params.end == t.params.start){
				will_del.push(t);
			} else if(t.params.state==2){
				retain_tasks.push(t);
			} else {
				will_re_build.push(t);
			}
		});
		console.log('will_del:',will_del);
		console.log('will_re_build:',will_re_build);
		console.log('retain_tasks:',retain_tasks);
		if(will_re_build)return;
		will_del.forEach(function(t){
			t.del();
		});
		var sub_total_size = 0;
		will_re_build.forEach(function(t){
			var s = t.size();
			if(s>0){
				sub_total_size += t.size();
			}
		});
		while(page_count>1 && sub_total_size/page_count < section_min_size){
		  page_count = page_count - 1;
		}
		var page_size = Math.round(sub_total_size/page_count);
		if(page_size<section_min_size) page_size = section_min_size;
		
		var loader_pos = 0;
		var task_params = {};
		ithis.tasks = [];
		for(var i=0;i<will_re_build.length;i++){
			var _t = will_re_build[i];
			var _size = _t.size();
			var start_pos = _t.params.start;
			var pos = 0;
			var loader = null;
			if(_t.cache_file_exist()){
				while(_size>page_size){
					loader = loader_list[loader_pos];
					task_params = {'id':_t.params.id+'_'+pos, 'source_id':_t.params.source_id, 'start':start_pos, 'end':start_pos+page_size, 'over':0, 'idx':0, 'retry':0, 'loader_id': loader.id, 'state': 0};
					var task = new Tasker(ithis, task_params);
					task.save();
					ithis.tasks.push(task);
					_size = _size - page_size;
					pos += 1;
					start_pos = start_pos + page_size;
					loader_pos = (loader_pos+1) % page_count;
				}
			}
			
			if(_size>0){
				loader = loader_list[loader_pos];
				task_params = {'id':_t.params.id+'_'+pos, 'source_id':_t.params.source_id, 'start':start_pos, 'end':_t.params.end, 'over':0, 'idx':0, 'retry':0, 'loader_id': loader.id, 'state': 0};
				var task = new Tasker(ithis, task_params);
				task.save();
				ithis.tasks.push(task);
				loader_pos = (loader_pos+1) % page_count;
			}
		}
		will_re_build.forEach(function(t){
			t.del();
		});
		retain_tasks.forEach(function(t){
			ithis.tasks.push(t);
		});
	},
	merge_task_files:function(cb){
		var ithis = this;
		function merge_a2b(t_a, t_b, target_file_name, callback){
			console.log('t_a, t_b, target_file_name:', t_a.params.id, t_b.params.id, target_file_name);
			var a_fn = t_a.params.id, b_fn = t_b.params.id;
			var a_file_path = path.join(ithis.download_file_path, a_fn);
			var b_file_path = path.join(ithis.download_file_path, b_fn);
			console.log("a_file_path, b_file_path:", a_file_path, b_file_path);
			if(fs.existsSync(a_file_path) && fs.existsSync(b_file_path)){
				console.log("merge in.");
				var states = fs.statSync(a_file_path);
				var a_file_size = states.size;
				states = fs.statSync(b_file_path);
				var b_file_size = states.size;
				var _final_file_path = path.join(ithis.download_file_path, "_"+target_file_name);
				var final_file = _final_file_path;
				var target_fs = fs.createWriteStream(final_file);
				var stream = fs.createReadStream(a_file_path);
				stream.pipe(target_fs, {end: false});
				stream.on("end", function(){
				  var b_stream = fs.createReadStream(b_file_path);
				  b_stream.pipe(target_fs);
				  b_stream.on("end", function(){
					  var final_states = fs.statSync(_final_file_path);
					  if(final_states.size == a_file_size+b_file_size){
						  fs.unlinkSync(a_file_path);
						  fs.unlinkSync(b_file_path);
						  var final_file_path = path.join(ithis.download_file_path, target_file_name);
						  if(fs.existsSync(final_file_path)){
							  fs.unlinkSync(final_file_path);
						  }
						  fs.rename(_final_file_path, final_file_path, (err)=>{
							  if(err) throw err;
						  });
					  }
					  if(callback){
						  callback(final_states.size);
					  }
				  });
				});
			}
		}
		var merge_task_map={};
		
		function deep_merge_task(pos){
			if(pos>=ithis.tasks.length){
				if(cb){
					cb();
				}
				return;
			}
			var t = ithis.tasks[pos];
			console.log("pos:", pos, ithis.tasks.length);
			console.log("params:", t.params);
			console.log("state:", t.params.state);
			if(t.params.end - t.params.start == 0){
				deep_merge_task(pos+1);
				return;
			}
			if(t.params.state == 0){
				deep_merge_task(pos+1);
			} else if(t.params.state == 2){
				if(pos==0){
					merge_task_map[pos]=t;
					deep_merge_task(pos+1);
				}else if(merge_task_map.hasOwnProperty(pos-1)){
					target_file_name = t.params.id;
					var t_a = merge_task_map[pos-1];
					var t_b = t;
					merge_a2b(t_a, t_b, target_file_name, (new_size)=>{
						console.log("update_pos:", t_a.params.start, new_size);
						t_a.update_pos(t_a.params.start, t_a.params.start,()=>{
							t_b.update_pos(t_a.params.start, t_a.params.start+new_size,()=>{
								merge_task_map[pos]=t;
								deep_merge_task(pos+1);
							});
						});
					});
				}else{
					merge_task_map[pos]=t;
					deep_merge_task(pos+1);
				}
			} else {
				deep_merge_task(pos+1);
			}
		}
		deep_merge_task(0);
	},
	start_tasker:function(on_end){
		/*
		{"id": "486285832886933_0", "source_id": "486285832886933", "start": 0, "end": 187011800, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 2}, {"id": "486285832886933_1", "source_id": "486285832886933", "start": 187011800, "end": 374023600, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 2}, {"id": "486285832886933_2", "source_id": "486285832886933", "start": 374023600, "end": 561035400, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 2}, {"id": "486285832886933_3", "source_id": "486285832886933", "start": 561035400, "end": 748047200, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 3}, {"id": "486285832886933_4", "source_id": "486285832886933", "start": 748047200, "end": 935059000, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 2}, {"id": "486285832886933_5", "source_id": "486285832886933", "start": 935059000, "end": 1122070800, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 2}, {"id": "486285832886933_6", "source_id": "486285832886933", "start": 1122070800, "end": 1309082600, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 2}, {"id": "486285832886933_7", "source_id": "486285832886933", "start": 1309082600, "end": 1496094400, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 2}, {"id": "486285832886933_8", "source_id": "486285832886933", "start": 1496094400, "end": 1683106197, "over": 0, "pos": 0, "retry": 0, "loader_id": 0, "state": 2},
		*/
		var ithis = this;
		ithis.is_ready = false;
		var maybe_merge = false;
		this.tasks.sort(function(task_a, task_b){
			return task_a.params["start"] - task_b.params["start"];
		});
		
		var new_tasks = [];
		var async_cnt = 0;
		var async_re_call = (pos)=>{
			if(pos>=ithis.tasks.length){
				final_call();
				return;
			}
			var t = ithis.tasks[pos];
			if(t.get_state() == 7){
				// final_call();
				async_re_call(pos+1);
				return;
			}
			console.log("start_tasker id:%s, source_id:%s", t.params.id, t.params.source_id);
			var params = t.params
			var fn = t.params.id;
			var file_path = path.join(ithis.download_file_path, fn);
			if(fs.existsSync(file_path)){
				var states = fs.statSync(file_path);
				if(states.size>0){
					if(t.size() == states.size){
						if(2 != t.get_state()){
							t.update_state(2,()=>{
								async_re_call(pos+1);
							});
							maybe_merge = true;
						} else {
							async_re_call(pos+1);
						}
					}else if(t.size() > states.size){
						if(states.size < skip_size){
							t.update_state(3,()=>{
								fs.unlinkSync(file_path);
								async_re_call(pos+1);
							});
						} else {
							// var new_start = t.params.start+states.size;
							var new_start = t.params.start;
							var id_prefix = t.params.id
							if(id_prefix.split("_").length>4){
								id_prefix = id_prefix.split("_")[0];
							}
							var task_params = {'id':id_prefix+'_'+pos, 'source_id':t.params.source_id, 'start':new_start, 'end':t.params.end, 'over':0, 'idx':0, 'retry':0, 'loader_id': t.params.loader_id, 'state': 0};
							var _task = new Tasker(ithis, task_params);
							async_cnt += 1;
							_task.save(()=>{
								t.update_pos(t.params.start, new_start, ()=>{
									t.update_state(2,()=>{
										t.check_file_size();
										async_re_call(pos+1);
									});
								});
							});
							new_tasks.push(_task);
							maybe_merge = true;
						}
					} else {
						async_re_call(pos+1);
					}
				} else {
					async_re_call(pos+1);
				}
			} else {
				async_re_call(pos+1);
			}
		};
		
		console.log("new_tasks len:", new_tasks.length);
		var final_call = ()=>{
			if(new_tasks.length>0){
				new_tasks.forEach(function(t){ithis.tasks.push(t);});
				ithis.tasks.sort(function(task_a, task_b){
					return task_a.params["start"] - task_b.params["start"];
				});
			}
			var _wrap_on_end = ()=>{
				if(on_end){
					on_end();
				}
			};
			console.log("maybe_merge:", maybe_merge);
			if( maybe_merge){
				ithis.merge_task_files(()=>{
					ithis.re_build_sub_tasks();
					ithis.ready_emit_tasks(_wrap_on_end);
				});
			}else{
				ithis.ready_emit_tasks(_wrap_on_end);
			}
		};
		async_re_call(0);
	},
	get_download_complete_size:function(){
		var ithis = this;
		var get_size = 0;
		this.tasks.forEach(function(t, index){
			var params = t.params
			var fn = t.params.id;
			if(t.get_state() == 2){
				var task_file_size = t.check_file_size();
				get_size = get_size + task_file_size;
			}
		});
		return get_size;
	},
	get_download_size:function(){
		var ithis = this;
		var get_size = 0;
		this.tasks.forEach(function(t, index){
			var params = t.params
			var fn = t.params.id;
			if(t.get_state() == 2 || t.get_state() == 1){
				var task_file_size = t.check_file_size();
				get_size = get_size + task_file_size;
			}
			// var task_file_size = t.check_file_size();
			// get_size = get_size + task_file_size;
		});
		return get_size;
	},
	get_total_length:function(){
		if(this.task.hasOwnProperty("total_length")){
			return this.task.total_length;
		} else {
			var max_size = 0;
			this.tasks.forEach(function(t, index){
				if(max_size < t.params.end){
					max_size = t.params.end;
				}
			});
			return max_size;
		}
	},
	update_task:function(key, value, cb){
		this.task[key] = value;
		var params = {};
		params[key] = value;
		download_task_db.update_by_id(this.task['id'], params, (_id, _params)=>{
			if(cb){
				cb(_id, _params);
			}
		})
	},
	patch_task_params:function(task_params){
		var fields = ['state', 'total_length', 'tm'];
		fields.forEach((k, index)=>{
			if(task_params.hasOwnProperty(k)){
				this.task[k] = task_params[k];
			}
		});
		// console.log('new task:', this.task);
	},
	del_sub_task:function(sub_task, cb){
		var ithis = this;
		if(!sub_task){
			if(cb){
				cb(sub_task, ithis);
			}
			return;
		}
		var fn = sub_task.params.id;
		sub_task.del(()=>{
			try{
				var file_path = path.join(ithis.download_file_path, fn);
				if(fs.existsSync(file_path)){
					fs.unlinkSync(file_path);
				}
			}catch(e){
				console.error(e);
			}
			if(cb){
				cb(sub_task, ithis);
			}
		});
	},
	complete:function(cb){
		var ithis = this;
		this.update_state(2, ()=>{
			ithis.tasks.forEach(function(t, index){
				ithis.del_sub_task(t)
			});
			ithis.checkout_loader_list((loader_list)=>{
				if(loader_list && loader_list.length>0){
					var ids = [];
					var useds = [];
					loader_list.forEach((l, idx)=>{
						if(l.used && l.used != 0){
							ids.push(l.pan_account_id);
							useds.push(l.used);
						}
					});
					if(ids.length>0){
						var _path = "source/sync_used";
						call_pansite_by_post(ithis.token, POINT, _path, {"ids": ids.join(','),"useds":useds.join(',')}, (result)=>{
							console.log('同步used数据完成!');
						});
					}
				}
				download_loader_db.del('source_id',ithis.task.id,()=>{
					if(cb){cb();}
				});
			});
			
			ithis.tasks = [];
		});
		
	},
	del:function(cb){
		var ithis = this;
		this.complete(()=>{
			console.log('del task:', ithis.task);
			download_task_db.del('id', ithis.task.id,()=>{
				looper.removeListener(ithis.task.id);
				delete MultiFileLoader.instance_map[ithis.task.id];
				if(cb){cb();}
			});
		});
	},
	update_state:function(state, cb){
		this.task['state'] = state;
		download_task_db.update_by_id(this.task['id'], {'state': state}, (_id, _params)=>{
			if(cb){cb(_id, _params)}
		});
	},
	is_loading:function(){
		return this.task['state'] == 1;
	},
	save_task_params:function(){
		if(this.saved){
			return;
		}
		var ithis = this;
		this.saved = true;
		this.download_file_path = path.join(download_path, this.task.id);
		// console.log('save_task_params will save task:', ithis.task);
		download_task_db.get('id',this.task.id,(_task)=>{
			if(_task){
				console.log('save_task_params will update task:', ithis.task.id, ',filename:',ithis.task.filename);
				download_task_db.update_by_id(ithis.task.id, ithis.task, next_fun);
			}else{
				console.log('will new task!');
				download_task_db.put(ithis.task, next_fun);
			}
		});
		var next_fun = ()=>{
			if(!fs.existsSync(this.download_file_path)){
			  fs.mkdirSync(this.download_file_path);
			}
			if(this.task['state'] == 2){
				MultiFileLoader.instance_map[this.task.id] = this;
				this.sender.send('asynchronous-reply', {'tag': 'synctasks', 'tasks': MultiFileLoader.instance_map})
			}
		};
		
	},
	_show_alert:function(msg){
		show_alert.show(msg,null,(state)=>{},{'modal':true, 'width':360, 'height':280});
	},
	move_file:function(cb){
		var ithis = this;
		var default_path = this.account.get_default_save_path((default_save_path)=>{
			_move_file(default_save_path);
			// ithis._show_alert('测试一下!')
		});
		function _move_file(default_path){
			if(!default_path){
				default_path = ithis.download_file_path;
			}
			const file_dirs = dialog.showOpenDialog({
				title: '选择'+ithis.task.filename+'迁移目录',
				buttonLabel: '迁移',
				defaultPath: default_path,
				properties: ['openDirectory']
			  });
			console.log('move_file target file_dir:', file_dirs);
			if(file_dirs && file_dirs.length>0 && fs.existsSync(file_dirs[0])){
				var file_dir = file_dirs[0];
				var new_file_path = path.join(file_dir, ithis.task.filename);
				console.log('new_file_path:', new_file_path);
				if(!fs.existsSync(new_file_path)){
					var final_file = path.join(ithis.download_file_path , ithis.task.filename);
					// console.log('copy final_file:', final_file, ' [to] ', new_file_path);
					if(fs.existsSync(final_file)){
						ithis.account.update_default_save_path(file_dir);
						fs.rename(final_file, new_file_path, (err)=>{
							if(err){
								console.log('err:', err);
								err_info = 'error:迁移失败!<br>';
								for(var k in err){
									err_info+=k+':'+err[k]+"<br>";
								}
								ithis._show_alert(err_info);
								if(cb){cb(1);}
							} else {
								if(cb){cb(0);}
								fs.rmdirSync(ithis.download_file_path);
							}
							
						});
					}
				} else {
					ithis._show_alert('存在同名文件,迁移失败!');
					if(cb){cb(1);}
				}
			} else {
				console.log('target file_dirs:', file_dirs, ', not exists!');
				if(cb){cb(1);}
			}
		}
	},
	constructor:function(account, item, sender, emit_tag, cb){
		this.account = account;
		var ithis = this;
		this.is_ready = false;
		this.checking_next_task = false;
		this.sender = sender;
		this.item = item;
		this.query_file_head_running = false;
		this.query_redirect_deep = 0;
		this.emit_tag = emit_tag;
		this.tasks = [];
		this.saved = false;
		this.check_tasks_events = [];
		if(!item.hasOwnProperty('tasks')){
			item['tasks'] = [];
		}
		// download_task_db.del('id',item['fs_id'])
		//state, 0:init, 1:loading, 2: over, 3: pause
		this.task = {'id': item['fs_id'], 'item_id': item['id'], 'md5_val': item['md5_val'], 'state': 0, 'filename': item['filename'], 'path': item['path'], 'parent': item['parent'], 'type':item['type'], 'tm': get_now_timestamp()};
		
		account.get_valid_token((tk)=>{
			if(cb){
				ithis.token = tk;
				cb(ithis);
			}
		});
		
		// console.log('download_path:', download_path);
		// console.log('download_path fs_id:', item['fs_id']);
		// this.download_file_path = path.join(download_path, this.task.id);
		// download_task_db.put(this.task);
		// if(!fs.existsSync(this.download_file_path)){
		//   fs.mkdirSync(this.download_file_path);
		// }
		
		// MultiFileLoader.instance_map[item.fs_id] = this;
		// sender.send('asynchronous-reply', {'tag': 'synctasks', 'tasks': MultiFileLoader.instance_map})
	},
	shutdown:function(){
		is_running = false;
	}
});
MultiFileLoader.stop = function(){looper.stop();}; 
MultiFileLoader.ready = function(){
	looper.start();
};
function new_by_task(account, params, sender){
	var item = {'fs_id': params.id, 'id': params.item_id, 'md5_val': params.md5_val, 'filename': params.filename, 'path': params.path, 'parent': params.parent, 'type': params.type};
	var mfl = new MultiFileLoader(account, item, sender, null, (_loader)=>{
		_loader.patch_task_params(params);
		_loader.save_task_params();
	});
	// console.log("new_by_task params:", params);
	// mfl.patch_task_params(params);
	// mfl.save_task_params();
}
MultiFileLoader.correct = function(account, sender, cb){
	account.get_valid_token((token)=>{
		download_task_db.query('state', 0, (init_task_list)=>{
			if(!init_task_list) init_task_list = [];
			download_task_db.query('state', 3, (pause_task_list)=>{
				if(!pause_task_list) pause_task_list = [];
				download_task_db.query('state', 1, (running_task_list)=>{
					if(!running_task_list) running_task_list = [];
					download_task_db.query('state', 2, (over_task_list)=>{
						if(!over_task_list) over_task_list = [];
						var task_list = pause_task_list.concat(init_task_list).concat(running_task_list)
						var end_pos = task_list.length-1;
						if(task_list && task_list.length>0){
							sync_task(0);
						}else{
							final_call();
						}
						function final_call(){
							if(over_task_list && over_task_list.length>0){
								over_task_list.forEach((t, index)=>{
									new_by_task(account, t, sender);
								});
							}
							if(cb){
								cb();
							}
						}
						function sync_task(pos){
							if(pos > end_pos){
								final_call();
								return;
							}
							var task = task_list[pos];
							if(task.state == 1){
								task.state = 3;
							}
							try{
								query_file_info(token, task.item_id, (res)=>{
									// console.log("res:", res);
									if(res.hasOwnProperty('error')){
										// res['tag'] = 'error';
										console.log(res.error);
									}else{
										var item = res.item;
										var mfl = new MultiFileLoader(account, item, sender, null, (_loader)=>{
											_loader.patch_task_params(task);
											_loader.download();
										});
										
										// MultiFileLoader.instance_map[item.fs_id] = mfl;
										// console.log("MultiFileLoader.instance_map:", MultiFileLoader.instance_map);
									}
									setTimeout(function(){sync_task(pos+1);}, 1);
								});
							}catch(e){
								//TODO handle the exception
								console.error(e);
								setTimeout(function(){sync_task(pos+1);}, 1);
							}
						}
						
					});
				});
			});
		});
		
	});
	// var token = account.get_valid_token();
	
};
MultiFileLoader.instance_map = {};
MultiFileLoader.query_file_info = query_file_info;
module.exports = MultiFileLoader;

