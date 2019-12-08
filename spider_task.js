const ele_remote = require('electron').remote;
if(ele_remote){
	
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
	
	var jQuery = null;
	var _id_reg = new RegExp("_id_", "g");
	var _title_reg = new RegExp("_title_tips_", "g");
	var _title_show_reg = new RegExp("_title_show_", "g");
	var item_format = '<div id="_id__h"><table width="100%" class="gridtable"><tr id="_id__tr"><td style="width:230px;"><div style="width:200px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;" title="_title_tips_">_title_show_</div></td><td><div id="_id__progressbar" title="_title_tips_"></div></td><td width="60px" id="_id__speed"></td><td width="40px"><button id="_id__btn">&nbsp;</button></td><td width="40px"><button id="_id__act_btn">&nbsp;</button></td></tr></table></div><div id="_id__sub_container">&nbsp;</div>';
	
	var ipcRenderer = require('electron').ipcRenderer;
	ipcRenderer.on('asynchronous-popwin', function(event, args){
		if('start' == args.tag){
			// console.log('popwin start args:', args);
			ipcRenderer.send('asynchronous-popwin-backend', {"tag":"ready"});
		} else if('ready_ok' == args.tag){
			var params = args.params;
			if(!jQuery){
				window.jQuery = jQuery = $ = require("jquery");
				jQuery.getScript("./www/js/jquery-ui/jquery-ui.js").done(function() {
					console.log('load ui ok!');
					init_widget(params);
				});
			} else {
				init_widget(params);
			}
			console.log('args:', args);
		} else if('progress' == args.tag){
			var item_id = args.id;
			var isover = args.over;
			var task = args.task;
			// console.log('progress args:', args);
			if(task.hasOwnProperty('over_count') && task.hasOwnProperty('total_count')){
				var over_count = task.over_count;
				var total_count = task.total_count;
				if(total_count>0 && task.pin != 9){
					var r = build_percentage(over_count, total_count);
					$('#'+item_id+'_speed').html(r+'%');
					$("#"+item_id+'_tr')[0].progressbar.progressbar("value", r);
				}
			}
			if(isover){
				$('#'+item_id+'_speed').html('100%');
				$("#"+item_id+'_tr')[0].progressbar.progressbar("value", 100);
				var btn = $('#'+item_id+'_btn');
				btn.hide();
			}
			
		} else if('statistic' == args.tag){
			var task = args.task,gparams = args.gparams;
			console.log('statistic args:', args);
			var item_id = task.id;
			var pin = task.pin;
			var tr = $("#"+item_id+'_tr');
			if(tr.length == 0){
				build_sub_widget(task);
				init_widget({"tasks":[task], 'gparams':gparams});
			}
			tr = $("#"+item_id+'_tr');
			if(pin==1){
				var act_btn = $('#'+item_id+'_act_btn');
				act_btn[0].context = task;
				var btn = $('#'+item_id+'_btn');
				btn[0].context = task;
				act_btn.on("click", function(event){
					var context=event.currentTarget.context;
					var pin = context.pin;
					console.log('act_btn pin:', pin);
					ipcRenderer.send('asynchronous-popwin-backend', {"tag":"delete_task", "task":context});
				});
				act_btn.show();
				btn.show();
				var _progressbar = $("#"+item_id+"_progressbar");
				tr[0].progressbar = _progressbar;
				var _prog = _progressbar.progressbar({
				      value: false,
				      change: function() {
				      },
				      complete: function() {
				      }
				    });
				update_task_desc(task);
			} else {
				var cnt = 0;
				if(task.hasOwnProperty('num')){
					cnt = task.num;
				}
				$('#'+item_id+'_speed').html(''+cnt);
				update_task_desc(task);
			}
		}
	});
	ipcRenderer.send('asynchronous-popwin-backend', {"tag":"init"});
	
	function build_percentage(part_val, total){
	  return Math.round((part_val/total) * 10000)/100;
	}
	
	function init_widget(params){
		var tasks = params.tasks;
		var gparams = params.gparams;
		var _html = '';
		var tasks_container = $("#tasks_container");
		tasks.sort(function(t_a, t_b){
			return t_b["id"] - t_a["id"];
		});
		for(var i=0;i<tasks.length;i++){
			var _t = tasks[i];
			var item_id = _t.id;
			var _title_desc = "至:" + _t.target_path+ ",从:"+_t.path;
			var _title_tips = "从:"+_t.path + "至:" + _t.target_path+':' + _t.name;
			var tr=tasks_container.find('#'+item_id+'_tr');
			var task_dom = item_format.replace(_id_reg, item_id).replace(_title_reg, _title_tips).replace(_title_show_reg, _title_desc);
			
			tasks_container.append($(task_dom));
			
			tr=tasks_container.find('#'+item_id+'_tr');
			var act_btn = $('#'+item_id+'_act_btn');
			act_btn[0].context = _t;
			var btn = $('#'+item_id+'_btn');
			btn[0].context = _t;
			btn.html("继续下载");
			btn.button({icon: "ui-icon-arrowthickstop-1-s", showLabel: false});
			act_btn.html("关闭任务");
			act_btn.button({icon: "ui-icon-close", showLabel: false});
			
			btn.on("click", function(event){
				var context=event.currentTarget.context;
				var pin = context.pin;
				console.log('btn pin:', pin);
				ipcRenderer.send('asynchronous-popwin-backend', {"tag":"start_transfer", "task":context, "quota":gparams.quota});
			});
			if([0,9].indexOf(_t.pin)>=0){
				btn.hide();
				act_btn.hide();
				var h_desc = '转存任务已删除!';
				if(_t.pin == 9){
				} else if(_t.pin == 0){
					h_desc = '继续扫描文件!';
				}
				$("#"+item_id+"_progressbar").html(h_desc);
			} else {
				build_sub_widget(_t);
				if([2,5].indexOf(_t.pin)>=0){
					btn.hide();
				}
			}
		}
		
	}
	function build_sub_widget(task){
		var item_id = task.id;
		var tr = $("#"+item_id+'_tr');
		var act_btn = $('#'+item_id+'_act_btn');
		act_btn[0].context = task;
		var btn = $('#'+item_id+'_btn');
		btn[0].context = task;
		act_btn.on("click", function(event){
			var context=event.currentTarget.context;
			var pin = context.pin;
			console.log('act_btn pin:', pin);
			ipcRenderer.send('asynchronous-popwin-backend', {"tag":"delete_task", "task":context});
		});
		act_btn.show();
		btn.show();
		var val = 0;
		if(task.hasOwnProperty('over_count') && task.hasOwnProperty('total_count')){
			var over_count = task.over_count;
			var total_count = task.total_count;
			if(total_count>0){
				val = build_percentage(over_count, total_count);
			}
		}
		var _progressbar = $("#"+item_id+"_progressbar");
		tr[0].progressbar = _progressbar;
		var _prog = _progressbar.progressbar({
		      value: false,
		      change: function() {
		      },
		      complete: function() {
		      }
		    });
		if(val>0){
			_progressbar.progressbar("option",{value:val});
			$('#'+item_id+'_speed').html(val+'%');
		}
		update_task_desc(task);
	}
	function update_task_desc(task){
		var _t = task;
		var item_id = task.id;
		var sub_container = item_id+"_sub_container";
		var task_desc = '';
		var total_size = 0, dirnum=0, num=0;
		if(_t.hasOwnProperty('total_size')){
			total_size = _t.total_size;
			if(task_desc.length>0){
				task_desc += ',';
			}
			task_desc += "[总容量:"+scale_size(total_size)+"]"
		}
		if(_t.hasOwnProperty('dirnum')){
			dirnum = _t.dirnum;
			if(task_desc.length>0){
				task_desc += ',';
			}
			task_desc += "[目录总数:"+dirnum+"]";
		}
		if(_t.hasOwnProperty('num')){
			num = _t.num;
			if(task_desc.length>0){
				task_desc += ',';
			}
			task_desc += "[文件总数:"+num+"]";
		}
		$("#"+sub_container).html(task.name+':'+task_desc);
	}
}