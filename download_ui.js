function build_percentage(part_val, total){
  return Math.round((part_val/total) * 10000)/100;
}
var icons = {
  header: "ui-icon-circle-arrow-e",
  activeHeader: "ui-icon-circle-arrow-s"
};
var _id_reg = new RegExp("_id_", "g");
var _title_reg = new RegExp("_title_", "g");
var item_format = '<h3 id="_id__h"><table width="100%" class="gridtable"><tr id="_id__tr"><td style="width:140px;"><div style="width:140px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;" title="_title_">_title_</div></td><td><div id="_id__progressbar" title="_title_"></div></td><td width="130px" id="_id__speed"></td><td width="40px"><button id="_id__btn">&nbsp;</button></td><td width="40px"><button id="_id__act_btn">&nbsp;</button></td></tr></table></h3><div id="_id__sub_container" style="height:120px;max-height:120px" class="sub_container">&nbsp;</div>';
function build_sub_progress(sub_task_id, r, title, sub_container){
	var elem_id = sub_task_id+"_sub_progressbar";
	var sub_progress = sub_container.find('#'+elem_id);
	if(sub_progress.length == 0){
		var prog_html = '<div id="'+elem_id+'" title="'+title+'" style="height:8px;"></div>';
		// sub_container.append($(prog_html));
		sub_container.prepend($(prog_html));
		sub_progress = $('#'+elem_id);
		sub_progress.progressbar({value: false});
		setTimeout(()=>{
			$("#accordion").accordion("refresh");
			update_sub_container(sub_task_id);
		},100);
		
	}
	sub_progress.attr('title', title);
	sub_progress.progressbar("value", r);
}
function check_sub_progress(sub_task_id, r, title, sub_container){
	var elem_id = sub_task_id+"_sub_progressbar";
	var sub_progress = sub_container.find('#'+elem_id);
	if(sub_progress.length > 0){
		sub_progress.attr('title', title);
		sub_progress.progressbar("value", r);
	}
}
function remove_accordion_item(sub_task_id){
	var sub_container = sub_task_id+"_sub_container";
	var h_id = sub_task_id+"_h";
	console.log('remove sub_container:', sub_container);
	console.log('remove sub_task_id:', h_id);
	$("#"+sub_container).remove();
	$("#"+h_id).remove();
	setTimeout(()=>{$("#accordion").accordion("refresh");},100);
}
function update_sub_container(loader_id){
	// var sub_container = $('#'+loader_id+'_sub_container');
	// sub_container.resizable('option','maxHeight', 120);
}
function init_sub_container(loader_id){
	// var sub_container = $('#'+loader_id+'_sub_container');
	// sub_container.resizable({
	//       maxHeight: 120,
	//       minHeight: 70
	//     });
}
var download_ui = {
	update_download_tasks: function(tasks){
		var tasks_container = $("#accordion");
		if(!tasks_container[0].obj){
			// tasks_container[0].obj = tasks_container.accordion({collapsible: true, active:false});
			// tasks_container[0].obj = tasks_container.accordion({heightStyle: "fill"});
			tasks_container[0].obj = tasks_container.accordion({heightStyle: "content",collapsible: true});
		}
		var loader_list = [];
		for(var loader_id in tasks){
			loader_list.push(tasks[loader_id]);
		}
		loader_list.sort(function(loader_a, loader_b){
			return loader_b.task["tm"] - loader_a.task["tm"];
		});
		// console.log('msg tasks:', tasks);
		for(var i=0;i<loader_list.length;i++){
			var loader = loader_list[i];
			var loader_id = loader.task.id;
			var tr=tasks_container.find('#'+loader_id+'_tr');
			if(tr.length==0){
				var task_dom = item_format.replace(_id_reg, loader_id).replace(_title_reg, loader.task.filename);
				console.log("task_dom:", task_dom);
				tasks_container.prepend($(task_dom));
				tr=tasks_container.find('#'+loader_id+'_tr');
				var act_btn = $('#'+loader_id+'_act_btn');
				act_btn[0].loader = loader;
				var btn = $('#'+loader_id+'_btn');
				btn[0].loader = loader;
				btn[0].state=loader.task.state;
				var val = 0;
				// console.log('loader.task.state:', loader.task.state);
				if([0, 3].indexOf(loader.task.state)>=0){
					btn.html("继续下载");
					btn.button({icon: "ui-icon-arrowthickstop-1-s", showLabel: false});
					act_btn.html("关闭任务");
					act_btn.button({icon: "ui-icon-close", showLabel: false});
				}else if(loader.task.state == 1){
					btn.html("暂停");
					btn.button({icon: "ui-icon-pause", showLabel: false});
				}else{
					btn.html("关闭任务");
					btn.button({icon: "ui-icon-close", showLabel: false});
					act_btn.html("迁移文件");
					act_btn.button({icon: "ui-icon-transferthick-e-w", showLabel: false});
					val = 100;
				}
				btn.on("click", function(event){
					var loader=event.currentTarget.loader;
					var state = loader.task.state;
					// var state=event.currentTarget.state;
					console.log('state:', state);
					if([0, 3].indexOf(state) >= 0){
						var elem_id = loader.task.id+"_sub_container";
						$('#'+elem_id).empty();
						ipcRenderer.send('asynchronous-message', {"tag":"redownload", "id": loader.task.id});
					}else if(1 == state){
						ipcRenderer.send('asynchronous-message', {"tag":"pause", "id": loader.task.id});
					}else{
						ipcRenderer.send('asynchronous-message', {"tag":"del_task", "id": loader.task.id});
						remove_accordion_item(loader.task.id);
					}
				});
				act_btn.on("click", function(event){
					var loader=event.currentTarget.loader;
					var state = loader.task.state;
					console.log('state:', state);
					if([0, 3].indexOf(state) >= 0){
						ipcRenderer.send('asynchronous-message', {"tag":"del_task", "id": loader.task.id});
						remove_accordion_item(loader.task.id);
					}else if(1 == state){
						
					}else{
						ipcRenderer.send('asynchronous-message', {"tag":"move_file", "id": loader.task.id});
					}
				});
				init_sub_container(loader_id);
				
				var _progressbar = $("#"+loader_id+"_progressbar");
				tr[0].progressbar = _progressbar;
				var _prog = _progressbar.progressbar({
				      value: false,
				      change: function() {
						  // tr.find('td:eq(1)').html(_prog.progressbar("value") + "%");
				      },
				      complete: function() {
				        dialog.dialog( "option", "buttons", [{
				          text: "Close",
				          click: function(){dialog.dialog('close');}
				        }]);
				        $(".ui-dialog button").last().trigger( "focus" );
				      }
				    });
				if(val>0){
					_progressbar.progressbar("option",{value:val});
				}
			}
			// console.log("loader:["+loader_id+"]:", loader);
		}
		setTimeout(()=>{$("#accordion").accordion("refresh");},100);
	},
	update_sub_tasks: function(args){
		var task_id = args.id;
		var isover = args.over;
		var task_param = args.task;
		var sub_task_params = args.tasks_params;
		var total_file_size = args.total_file_size;
		var total_length = args.total_length;
		var need = args.need;
		var r = build_percentage(total_file_size, total_length);
		var speed = args.speed;
		// console.log('update_sub_tasks args:', args);
		var sub_task_prog = {};
		var sub_info = '';
		if(sub_task_params){
			var sub_container = $('#'+task_id+'_sub_container');
			sub_task_params.forEach((st, idx)=>{
				var sub_speed = st.speed;
				sr = build_percentage(st.get_size, st.end-st.start);
				var sub_title = "下载节点:"+st.id+","+sr+"%";
				if(sub_speed){
					sub_title = sub_title + "|" + sub_speed;
				}
				if(st.state != 2){
					build_sub_progress(st.id, sr, sub_title, sub_container);
				} else {
					check_sub_progress(st.id, sr, sub_title, sub_container)
				}
			});
		}
		var btn = $('#'+task_id+'_btn');
		var act_btn = $('#'+task_id+'_act_btn');
		var loader = btn[0].loader;
		var _state = loader?btn[0].loader.task.state:0;
		// console.log('_state:',_state);
		// console.log('task_param.state:',task_param.state);
		if(_state != task_param.state){
			loader.task.state = task_param.state;
			if([0, 3].indexOf(task_param.state)>=0){
				btn.html("继续下载");
				btn.button("option",{icon: "ui-icon-arrowthickstop-1-s"});
				act_btn.html("关闭任务");
				act_btn.button("option",{icon: "ui-icon-close"});
			}else if(task_param.state == 1){
				btn.html("暂停");
				btn.button("option",{icon: "ui-icon-pause"});
			}else{
				btn.html("关闭任务");
				btn.button("option",{icon: "ui-icon-close"});
				act_btn.html("迁移文件");
				act_btn.button("option",{icon: "ui-icon-transferthick-e-w"});
				
			}
			btn.button("refresh");
		}
		if(isover){
			speed = '-';
			need = '-';
		}
		$('#'+task_id+'_speed').html(r+'%|'+speed+'|'+need);
		$("#"+task_id+'_tr')[0].progressbar.progressbar("value", r);
		
		
	}
};
module.exports = download_ui;