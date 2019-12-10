

const ele_remote = require('electron').remote;
const max_retry_cnt = 5;
var inject_btn_group = false;
var to_find_share_btn = false;
if(ele_remote){
	window.test_recursive = (task_id,fid)=>{
		ipcRenderer.send('asynchronous-spider-backend', {"tag":"test_recursive", "task_id":task_id, 'folder_id':fid});
	};
	// test_recursive(1575901700377, '738885055643055')
	var helpers = {
		isArray: function(value) {
			if (Array.isArray && Array.isArray(value)) {
				return true;
			}
			var type = Object.prototype.toString.call(value);
			if (type.substr(0, 7) === '[object' && type.substr(-6) === 'Array]') {
				return true;
			}
			return false;
		},
		isObject: function(value) {
			return value !== null && Object.prototype.toString.call(value) === '[object Object]';
		},
		clone: function(source) {
			if (helpers.isArray(source)) {
				return source.map(helpers.clone);
			}
		
			if (helpers.isObject(source)) {
				var target = {};
				var keys = Object.keys(source);
				var klen = keys.length;
				var k = 0;
		
				for (; k < klen; ++k) {
					target[keys[k]] = helpers.clone(source[keys[k]]);
				}
		
				return target;
			}
		
			return source;
		},
		_merger: function(key, target, source, options) {
			var tval = target[key];
			var sval = source[key];
		
			if (helpers.isObject(tval) && helpers.isObject(sval)) {
				helpers.merge(tval, sval, options);
			} else {
				target[key] = helpers.clone(sval);
			}
		},
		merge: function(target, source, options) {
			var sources = helpers.isArray(source) ? source : [source];
			var ilen = sources.length;
			var merge, i, keys, klen, k;
		
			if (!helpers.isObject(target)) {
				return target;
			}
		
			options = options || {};
			merge = options.merger || helpers._merger;
		
			for (i = 0; i < ilen; ++i) {
				source = sources[i];
				if (!helpers.isObject(source)) {
					continue;
				}
		
				keys = Object.keys(source);
				for (k = 0, klen = keys.length; k < klen; ++k) {
					merge(keys[k], target, source, options);
				}
			}
		
			return target;
		},
		extend: Object.assign || function(target) {
			return helpers.merge(target, [].slice.call(arguments, 1), {
				merger: function(key, dst, src) {
					dst[key] = src[key];
				}
			});
		}
	};
	console.log('require document :', document);
	
	var _id_reg = new RegExp("_id_", "g");
	var _title_reg = new RegExp("_title_", "g");
	var _title_show_reg = new RegExp("_title_show_", "g");
	var item_format = '<h3 id="_id__h"><table width="100%" class="gridtable"><tr id="_id__tr"><td style="width:130px;"><div style="width:130px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;" title="_title_">_title_show_</div></td><td><div id="_id__progressbar" title="_title_"></div></td><td width="95px" id="_id__speed"></td><td width="40px"><button id="_id__btn">&nbsp;</button></td><td width="40px"><button id="_id__act_btn">&nbsp;</button></td></tr></table></h3><div id="_id__sub_container">&nbsp;</div>';
	
	var global_base_params = {};
	window.global_base_params = global_base_params;
	var target_map={};
	var ipcRenderer = require('electron').ipcRenderer;
	var dialog = null;
	var dialog_max_width = 450;
	function get_shared_params(task){
		var params = {};
		if(global_base_params.hasOwnProperty('group_list')){
			var group_list = global_base_params.group_list;
			if(group_list.hasOwnProperty('records')){
				var records = group_list.records;
				for(var i=0;i<records.length;i++){
					var si = records[i];
					if(si.gid == task.gid){
						
						break;
					}
				}
			}
		}
	}
	var tm_id = Date.now()+'_'+Math.round(Math.random()*1000);
	ipcRenderer.on('asynchronous-spider', function(event, args){
		// console.log("recv args:", args);
		if('start'==args.tag){
			var base_dir = args.base_dir;
			if(args.params){
				helpers.extend(global_base_params, args.params);
			}
			setTimeout(()=>{ipcRenderer.send('asynchronous-spider-backend', {"tag":"check_loc", "loc":document.location.href, 'uid':tm_id});},500);
			// init_widget(base_dir);
			// window.__stat_spider();
		}else if('click' == args.tag){
			var key = args.target;
			console.log('will call target click!');
			if(target_map[key]){
				// target_map[key].click();
			}
		}else if('find_share_btn' == args.tag){
			var task = args.task;
			var gparams = args.gparams;
			var options={'root':{'tag':'div.module-header-wrapper','attrs':{'node-type':'module-header-wrapper'}},'parent':{'tag':'span.cMEMEF', 'attrs':{'node-type':'mbox-homepage'}},'tag':'a','attrs':{'title':'分享','target':'_self','node-type':'item-title'}};
			if(!to_find_share_btn){
				to_find_share_btn = true;
				setTimeout(()=>{
					fetch_element_until_fetched(options, (elems)=>{
						console.log('share button elems:', elems);
						if(elems && elems.length>0){
							ipcRenderer.send('asynchronous-spider-backend', {"tag":"find_share_btn_ok", "loc":document.location.href, 'task':task, 'gparams':gparams});
							setTimeout(()=>{
								// next_check(args, true)
								elems[0].click();
							}, 1000);
							
						}
					}, 0, true);
				}, 300);
			}
		}else if('find_group_btn' == args.tag){
			var options = args.options;
			var task = args.task;
			var gparams = args.gparams;
			window._options = {};
			helpers.extend(window._options, options);
			console.log('_options:', _options);
			setTimeout(()=>{
				fetch_element_until_fetched(options, (elems)=>{
					console.log('group elems:', elems);
					if(elems && elems.length>0){
						elems[0].click();
						setTimeout(()=>{next_check_share_folder(args)}, 2000);
					}
				},0, true);
			}, 300);
		}else if('inject_btn_group' == args.tag){
			var options = args.options;
			console.log('recv inject_btn_group command!');
			if(!inject_btn_group){
				inject_btn_group = true;
				setTimeout(()=>{
					fetch_element_until_fetched(options, (elems)=>{
						console.log('group elems:', elems);
						if(elems && elems.length>0){
							elems[0].click();
							setTimeout(()=>{next_check_nav(args, true)}, 2000);
						}
					}, 0, true);
				}, 300);
			}
			
		}else if('intercepted' == args.tag){
			var st = args.st;
			if(st == 0){
				alert('拦截功能已开!');
				window.closeIntercept=()=>{ipcRenderer.send('asynchronous-spider-backend', {"tag":"close-intercept", "loc":document.location.href});};
			} else {
				alert(args.err);
			}
		}else if('unintercepted' == args.tag){
			var st = args.st;
			if(st == 0){
				alert('拦截功能已关闭!');
			} else {
				alert(args.err);
			}
		}else if('fetch_shared_params' ==args.tag){
			if(global_base_params){
				if(!global_base_params.hasOwnProperty('shared_params')){
					global_base_params['shared_params'] = args.params;
				} else {
					helpers.extend(global_base_params['shared_params'], args.params);
				}
			}
		}else if('fetch_base_params' == args.tag){
			var tasks = args.tasks;
			if(global_base_params){
				helpers.extend(global_base_params, args.params);
			} else {
				global_base_params = args.params;
			}
			// window.global_base_params = global_base_params;
			// console.log('global_base_params:', global_base_params);
			ch, web_val, appid, ctype
			var bdtk=global_base_params.bdstoken, ch=global_base_params.channel, 
			web_val = global_base_params.web[0], appid=global_base_params.app_id, ctype=global_base_params.clienttype;
			bd_proxy_api.quota(bdtk, ch, web_val, appid, ctype, (err, res)=>{
				if(res){
					global_base_params['quota'] = res;
					setTimeout(()=>{bd_proxy_api.fetch_group_list(bdtk, ch, web_val, appid, ctype, (err, res)=>{
						if(res){
							global_base_params['group_list'] = res;
						}
						ipcRenderer.send('asynchronous-spider-backend', {"tag":"fetched_base_params", "params":global_base_params});
						if(tasks && tasks.length>0){
							ipcRenderer.send('asynchronous-spider-backend', {"tag":"dialog", "params":{'tasks':tasks, 'gparams':global_base_params}, "loc":document.location.href});
						}
					});}, 100);
					// dialog modal
					
				}
			});
			// bd_proxy_api.fetch_group_list()
		}else if('fetch_file_list_continue'==args.tag){
			// console.log('deep_fetch_file_list_by_fid continue.');
			var params = args.params, fid_list = args.fid_list, parent_dir = args.parent_dir, target_dir=args.target_dir, pos = args.pos;
			var task = args.task;
			deep_fetch_file_list_by_fid(fid_list, parent_dir, target_dir, params, pos, false, task.name);
		}else if('fetch_file_list_complete'==args.tag){
			// alert('文件分析完成!');
		}else if('fetched_bd_context_ready' == args.tag){
			var fid_list = args.fid_list;
			var global_params = args.global_params;
			if(!global_base_params.shared_params && global_params.share_params){
				global_base_params.shared_params = global_params.share_params;
			}
			// console.log('window.__bd_ctx:', window.__bd_ctx);
			if(window.__bd_ctx){
				var _mMoveSaveDialog = __bd_ctx.getService(__bd_ctx.SERVICE_FIEL_TREE_MANAGER);
				_mMoveSaveDialog.reBuild({
						type: "transfer",
						title: "保存到",
						confirmBack: function(t) {
							var target_dir = t;
							console.log('target_dir:', target_dir);
							var parent_dir = fetch_parent_dir();
							deep_fetch_file_list_by_fid(fid_list, parent_dir, target_dir, null, null, true);
						},
						cancleBack: function() {
						}
					}
				);
			}
		}else if('fetched_sub_file_list_continue' == args.tag){
			var fid_list = args.fid_list, parent_dir = args.parent_dir, target_dir=args.target_dir;
			var task = args.task;
			console.log('fetched_sub_file_list_continue fid_list:', fid_list, ',parent_dir:', parent_dir);
			var params={
				msgid:task.msg_id,
				fromuk:task.from_uk, 
				_gid:task.gid,
				ftype:task.stype, 
				bdtk:global_base_params.bdstoken, 
				ch:global_base_params.channel, 
				web_val:global_base_params.web[0], 
				appid:global_base_params.app_id, 
				ctype:global_base_params.clienttype, 
				page:1
			};
			deep_fetch_file_list_by_fid(fid_list, parent_dir, target_dir, params, null, false, task.name);
		}else if('check_self_dir' == args.tag){
			var parent_item= args.parent_item, file=args.file, task= args.task;
			var dir = args.dir;
			check_self_list(dir, true, (rs)=>{
				console.log('check_self_dir final rs:', rs);
				if(rs){
					ipcRenderer.send('asynchronous-spider-backend', {"tag":"check_self_dir_end", "dir":dir, "rs":rs, "task":task, "file": file, "parent_item": parent_item});
				}
			});
		}else if('start_transfer' == args.tag){
			var parent_item= args.parent_item, file=args.file, task= args.task;
			// console.log('global_base_params:', global_base_params);
			// console.log('window global_base_params:', window.global_base_params);
			if(!global_base_params.hasOwnProperty('remain')){
				global_base_params.remain = global_base_params.quota.free;
			}
			var remain = global_base_params.remain;
			console.log('remain:%s, file size:%s', remain, file.size);
			if(remain > file.size){
				ipcRenderer.send('asynchronous-spider-backend', {"tag":"to_check_file_dir", "task":task, "file": file, "parent_item": parent_item});
			} else {
				alert('空间剩余不足!');
			}
		} else if('to_transfer_confirm' == args.tag){
			var parent_item= args.parent_item, file=args.file, task= args.task, target_dir = args.target_dir;
			var tmp_max_retry_cnt = 1;
			
			function to_transfer_file(task, file, target_dir,tmp_retry_cnt){
				bd_proxy_api.transfer_file(task, file, target_dir, (err, rs)=>{
					var maybe_failed = false;
					if(rs){
						if(rs.errno == 0){
							global_base_params.remain = global_base_params.remain - file.size;
							ipcRenderer.send('asynchronous-spider-backend', {"tag":"transfer_ok_continue", "task":task, "file": file, "parent_item": parent_item});
						}else{
							maybe_failed = true;
						}
					} else {
						maybe_failed = true;
					}
					if(maybe_failed){
						if(tmp_retry_cnt<tmp_max_retry_cnt){
							console.log('to_transfer_confirm err! wait 2 seconds,will to retry!:', rs);
							//TODO check file or folder exists.
							
							setTimeout(()=>{
								var _check_dir = target_dir + "/" + file.filename;
								console.log('检测目标文件是否已存在:', _check_dir);
								check_self_list(_check_dir, false, (rs)=>{
									if(rs.errno == 0){
										console.log('目标文件已存在,继续执行:', file);
										global_base_params.remain = global_base_params.remain - file.size;
										ipcRenderer.send('asynchronous-spider-backend', {"tag":"transfer_ok_continue", "task":task, "file": file, "parent_item": parent_item, "skip":true});
									} else {
										console.log('check_self_list rs:', rs);
										to_transfer_file(task, file, target_dir, tmp_retry_cnt + 1);
									}
								});
							}, 2000);
						} else {
							console.log('to_transfer_confirm err:', rs);
							ipcRenderer.send('asynchronous-spider-backend', {"tag":"transfer_ok_continue_failed", "task":task, "file": file, "parent_item": parent_item});
						}
					}
				});
			}
			// to_transfer_file(task, file, target_dir, 0)
			if(task.hasOwnProperty('retry')){
				if(task.retry){
					var _check_dir = target_dir + "/" + file.filename;
					console.log('检测目标文件是否已存在:', _check_dir);
					check_self_list(_check_dir, false, (rs)=>{
						if(rs.errno == 0){
							console.log('目标文件已存在,继续执行:', file.path);
							global_base_params.remain = global_base_params.remain - file.size;
							ipcRenderer.send('asynchronous-spider-backend', {"tag":"transfer_ok_continue", "task":task, "file": file, "parent_item": parent_item, "skip":true});
						} else {
							console.log('check_self_list rs:', rs);
							to_transfer_file(task, file, target_dir, 0);
						}
					});
				} else {
					to_transfer_file(task, file, target_dir, 0)
				}
			} else {
				to_transfer_file(task, file, target_dir, 0)
			}
			
		} else if('transfer_complete' == args.tag){
			alert('文件转存完成!');
		}
	});
	setTimeout(()=>{ipcRenderer.send('asynchronous-spider-backend', {"tag":"check_loc", "loc":document.location.href, 'uid':tm_id});},2000);

	function init_widget(){
		
	}
	
	window.to_start_transfer = function(){
		ipcRenderer.send('asynchronous-spider-backend', {"tag":"to_start_transfer", "app_id":global_base_params.app_id});
	};
	
	function next_check_share_folder(args){
		var options={'root':{'tag':'div.module-content-all'},'parent':{'tag':'div.file-factory', 'attrs':{'node-type':'file-factory'}},'tag':'span.button'};
		fetch_element_until_fetched(options, (elems)=>{
			console.log('next_check_share_folder elems:', elems);
			if(elems && elems.length>0){
				elems[0].click();
				setTimeout(()=>{
					ipcRenderer.send('asynchronous-spider-backend', {"tag":"init_page_ok", "gparams":global_base_params});
				}, 2000);
			}
		}, 0, true);
	}
	
	function next_check_nav(args, until){
		var __options={'root':{'tag':'div.main-files', 'attrs':{'node-type':'main-content'}},
		'parent':{'tag':'div.module-sharelist', 'attrs':{'node-type':'sharelist'}},
		'attrs':{'node-type':'sharelist-operate'},
		'tag':'div.sharelist-operate',
		};
		var func = to_find_group_btn;
		if(until){
			func = fetch_element_until_fetched;
		}
		func(__options, (elems)=>{
			console.log('nav elems:', elems);
			if(elems && elems.length>0){
				var nav = elems[0];
				var btn=document.createElement("BUTTON");
				// btn.value='动态导入';
				btn.innerHTML = '不限量转存';
				nav.appendChild(btn);
				btn.onclick=function(e){
					valid_check_boxs(document.querySelector('div.sharelist-container[node-type="sharelist-container"]'), (fid_list, isdir_map)=>{
						console.log('fid_list:', fid_list);
						if(fid_list){
							ipcRenderer.send('asynchronous-spider-backend', {"tag":"fetched_bd_context", "fid_list":fid_list});
						}
					});
				};
				// ipcRenderer.send('asynchronous-spider-backend', {"tag":"intercept", "loc":document.location.href});
			}
		}, null, until);
	}
	function fetch_parent_dir(){
		var p = document.querySelector('div.sharelist-header').querySelector('li[node-type="sharelist-history-list"]');
		var a_list = p.querySelectorAll('a[data-deep]');
		var parent_dirs = [];
		a_list.forEach((aobj,idx)=>{parent_dirs.push(aobj.getAttribute('title'))});
		var c_dir = p.querySelector('span:last-child');
		if(c_dir){
			parent_dirs.push(c_dir.getAttribute('title'));
		}
		return parent_dirs;
	}
	function deep_fetch_file_list_by_fid(fid_list, parent_dir, target_dir, params, pos, first_layer, task_name){
		if(!pos){
			pos = 0;
		}
		var retry_cnt = 0;
		var deep_call=(pos)=>{
			if(pos>=fid_list.length){
				ipcRenderer.send('asynchronous-spider-backend', {"tag":"fetched_file_list", "params":params, "fid_list":fid_list, "parent_dir":parent_dir, "target_dir":target_dir, "pos":pos, "result":[], "app_id":global_base_params.app_id});
				return;
			}
			if(!params){
				params={
					msgid:global_base_params.shared_params.msg_id,
					fromuk:global_base_params.shared_params.from_uk, 
					_gid:global_base_params.shared_params.gid,
					ftype:global_base_params.shared_params.type, 
					bdtk:global_base_params.bdstoken, 
					ch:global_base_params.channel, 
					web_val:global_base_params.web[0], 
					appid:global_base_params.app_id, 
					ctype:global_base_params.clienttype, 
					page:1
				};
			}
			params.fid = fid_list[pos];
			bd_proxy_api.fetch_file_list_by_fid(params, (err, rs)=>{
				// console.log('rs:', rs);
				if(rs){
					if(rs.errno !=0 ){
						console.log('fetch_file_list_by_fid err rs:', rs);
						var skip = false;
						if(rs.errno == -9){
							// ipcRenderer.send('asynchronous-spider-backend', {"tag":"scan_file_list_failed", "params":params, "fid_list":fid_list, "parent_dir":parent_dir, "target_dir":target_dir, "pos":pos, "result":rs, "app_id":global_base_params.app_id, "task_name": task_name});
							if(retry_cnt >= 2){
								retry_cnt = 0;
								skip = true;
								ipcRenderer.send('asynchronous-spider-backend', {"tag":"fetched_file_list", "params":params, "fid_list":fid_list, "parent_dir":parent_dir, "target_dir":target_dir, "pos":pos, "result":rs, "app_id":global_base_params.app_id, "task_name": task_name});
								// setTimeout(function() {deep_call(pos+1);}, 500+100*retry_cnt);
							}
						}
						if(!skip){
							if(retry_cnt < 15){
								setTimeout(function() {deep_call(pos);}, 500+100*retry_cnt);
							} else {
								ipcRenderer.send('asynchronous-spider-backend', {"tag":"scan_file_list_failed", "params":params, "fid_list":fid_list, "parent_dir":parent_dir, "target_dir":target_dir, "pos":pos, "result":rs, "app_id":global_base_params.app_id, "task_name": task_name, "msg":'扫描文件异常!'});
							}
							retry_cnt += 1;
						}
					} else {
						window.fetch_file_list_rs = rs;
						if(rs.hasOwnProperty('records')){
							if(first_layer){
								var records = rs.records;
								if(records.length>0){
									var r = records[0];
									var fn = r.server_filename;
									var path = r.path;
									var __idx = path.lastIndexOf(fn);
									var _path = path.substring(0, __idx);
									if(_path.length>0){
										if(_path[0] == '/'){
											_path = _path.substring(1, _path.length);
										}
										if(_path[_path.length-1] == '/'){
											_path = _path.substring(0, _path.length-1);
										}
										if(_path.length>0){
											_p_dirs = _path.split("/");
											task_name = _p_dirs.splice(_p_dirs.length-1, 1);
											parent_dir = _p_dirs;
										}
										
									}
									
								}
							}
							ipcRenderer.send('asynchronous-spider-backend', {"tag":"fetched_file_list", "params":params, "fid_list":fid_list, "parent_dir":parent_dir, "target_dir":target_dir, "pos":pos, "result":rs, "app_id":global_base_params.app_id, "task_name": task_name});
						} else {
							retry_cnt = 0;
							setTimeout(function() {deep_call(pos+1);}, 500+100*retry_cnt);
						}
					}
					
				}else if(err){
					console.log('rs:', rs);
					setTimeout(function() {deep_call(pos);}, 500+100*retry_cnt);
					retry_cnt += 1;
				}
			});
		};
		deep_call(pos);
	}
	function check_self_list(dir, create_on_not_exist, callback){
		var bdtk=global_base_params.bdstoken, ch=global_base_params.channel, 
		web_val=global_base_params.web[0], appid=global_base_params.app_id, ctype=global_base_params.clienttype;
		bd_proxy_api.self_file_list(dir, bdtk, ch, web_val, appid, ctype, 1,(err, rs)=>{
			if(rs){
				if(rs.errno == -9){
					if(create_on_not_exist){
						self_create_folder(dir, (err, rs)=>{
							callback(rs);
						});
					}else{
						callback(rs);
					}
				} else {
					callback(rs);
				}
			} else {
				callback(null);
			}
			
		});
	}
	function self_create_folder(path, callback){
		var bdtk=global_base_params.bdstoken, ch=global_base_params.channel, 
		web_val=global_base_params.web[0], appid=global_base_params.app_id, ctype=global_base_params.clienttype;
		bd_proxy_api.self_create_folder(path, bdtk, ch, web_val, appid, ctype, callback);
	}
	window.check_self_list= check_self_list;
	window.self_create_folder= self_create_folder;
	function _build_get_url(path, params){
		var url = "";
		for(var p in params){
			var val = params[p];
			if(["bdstoken","logid", "dir"].indexOf(p) < 0){
				val = encodeURIComponent(val);
			}
			if(url.length == 0){
				url = p + "=" + val;
			} else {
				url = url + "&" + p + "=" + val;
			}
		}
		if(path && path.length>0){
			return path + "?" + url;
		} else {
			return url;
		}
	}
	
	var bd_proxy_api={
		'fetch_group_list':function(bdtk, ch, web_val, appid, ctype, callback){
			var path = '/mbox/group/groupsession';
			var params = {
				t:Date.now(),
				bdstoken:bdtk,
				channel:ch,
				web:web_val,
				app_id:appid,
				logid:baidu_api.build_log_id(),
				clienttype:ctype
			};
			var url = _build_get_url(path, params);
			console.log('fetch_group_list url:', url);
			baidu_api.get_req(url, (rs)=>{
				if(rs.errno!=0){
					console.log('group list err rs:', rs);
				}
				if(callback){
					callback(null, rs);
				}
			},(err)=>{
				if(callback){
					callback("failed", null);
				}
			});
		},
		'transfer_file':function(task, file, target_dir, callback){
			var path = '/mbox/msg/transfer';
			var params = {
				bdstoken:global_base_params.bdstoken,
				channel:global_base_params.channel,
				web:global_base_params.web[0],
				app_id:task.app_id,
				logid:baidu_api.build_log_id(),
				clienttype:global_base_params.clienttype
			};
			var url = _build_get_url(path, params);
			var form_data = {
				from_uk:task.from_uk,
				msg_id:task.msg_id,
				path:target_dir,
				ondup:'newcopy',
				async:1,
				type:2,
				gid:task.gid,
				fs_ids:'['+file.id+']'
			}
			function re_call_fun(retry_cnt){
				if(!retry_cnt){
					retry_cnt = 0;
				}
				baidu_api.post_req(url, form_data, 'formdata', (rs)=>{
					if(rs.errno!=0){
						console.log('transfer_file err rs:', rs);
					}
					if(callback){
						callback(null, rs);
					}
				},(err)=>{
					if(retry_cnt < max_retry_cnt){
						console.log('transfer_file to retry call:', err);
						setTimeout(()=>{re_call_fun(retry_cnt+1);}, 1000 + retry_cnt * 100);
					} else {
						if(callback){
							callback("failed", null);
						}
					}
				});
			}
			re_call_fun(0);
			
		},
		'self_create_folder':function(_path, bdtk, ch, web_val, appid, ctype, callback){
			var path = '/api/create';
			var params = {
				a:'commit',
				bdstoken:bdtk,
				channel:ch,
				web:web_val,
				app_id:appid,
				logid:baidu_api.build_log_id(),
				clienttype:ctype
			};
			var url = _build_get_url(path, params);
			var form_data = {
				path: _path,
				isdir:1,
				size:'',
				block_list:'[]',
				method:'post'
			}
			function re_call_fun(retry_cnt){
				if(!retry_cnt){
					retry_cnt = 0;
				}
				baidu_api.post_req(url, form_data, 'formdata', (rs)=>{
					if(rs.errno!=0){
						console.log('create folder err rs:', rs);
					}
					if(callback){
						callback(null, rs);
					}
				},(err)=>{
					if(callback){
						callback("failed", null);
					}
					if(retry_cnt < max_retry_cnt){
						console.log('self_create_folder to retry call:', err);
						setTimeout(()=>{re_call_fun(retry_cnt+1);}, 1000 + retry_cnt * 100);
					} else {
						if(callback){
							callback("failed", null);
						}
					}
				});
				
			}
			re_call_fun(0);
			
			// {"fs_id":533567695178108,"path":"\/_tmp\/shared\/\u542f\u58a8\u5b66\u9662","ctime":1575282783,"mtime":1575282783,"status":0,"isdir":1,"errno":0,"name":"\/_tmp\/shared\/\u542f\u58a8\u5b66\u9662","category":6}
		},
		'self_file_list':function(_dir, bdtk, ch, web_val, appid, ctype, cnt, callback){
			var path = '/api/list';
			var params = {
				dir:_dir,
				bdstoken:bdtk,
				channel:ch,
				web:web_val,
				app_id:appid,
				logid:baidu_api.build_log_id(),
				clienttype:ctype,
				num:cnt
			};
			var url = _build_get_url(path, params);
			function re_call_fun(retry_cnt){
				if(!retry_cnt){
					retry_cnt = 0;
				}
				baidu_api.get_req(url, (rs)=>{
					if(rs.errno!=0 && rs.errno!=-9){
						console.log('file list sys err rs:', rs);
					}
					if(callback){
						callback(null, rs);
					}
				},(err)=>{
					if(retry_cnt < max_retry_cnt){
						console.log('self_file_list to retry call:', err);
						setTimeout(()=>{re_call_fun(retry_cnt+1);}, 1000 + retry_cnt * 100);
					} else {
						if(callback){
							callback("failed", null);
						}
					}
				});
			}
			re_call_fun(0);
			
		},
		'quota':function(bdtk, ch, web_val, appid, ctype, callback){
			var path = '/api/quota';
			var params = {
				checkexpire:1,
				checkfree:1,
				bdstoken:bdtk,
				channel:ch,
				web:web_val,
				app_id:appid,
				logid:baidu_api.build_log_id(),
				clienttype:ctype
			};
			var url = _build_get_url(path, params);
			function re_call_fun(retry_cnt){
				if(!retry_cnt){
					retry_cnt = 0;
				}
				baidu_api.get_req(url, (rs)=>{
					if(rs.errno!=0){
						console.log('quota err rs:', rs);
					}
					if(callback){
						callback(null, rs);
					}
				},(err)=>{
					if(retry_cnt < max_retry_cnt){
						console.log('quota to retry call:', err);
						setTimeout(()=>{re_call_fun(retry_cnt+1);}, 1000 + retry_cnt * 100);
					} else {
						if(callback){
							callback("failed", null);
						}
					}
				});
			}
			re_call_fun(0);
			
		},
		'fetch_file_list_by_fid':function(params, callback){
			var fid = params.fid, msgid=params.msgid, fromuk=params.fromuk, _gid=params._gid,
			ftype=params.ftype, bdtk=params.bdtk, ch=params.ch, web_val=params.web_val, 
			appid=params.appid, ctype=params.ctype, page=params.page;
			var path = '/mbox/msg/shareinfo';
			var params = {
				msg_id:msgid,
				page:page,
				num:50,
				from_uk:fromuk,
				gid:_gid,
				type:ftype,
				fs_id:fid,
				bdstoken:bdtk,
				channel:ch,
				web:web_val,
				app_id:appid,
				logid:baidu_api.build_log_id(),
				clienttype:ctype
			};
			var url = _build_get_url(path, params);
			function re_call_fun(retry_cnt){
				if(!retry_cnt){
					retry_cnt = 0;
				}
				baidu_api.get_req(url, (rs)=>{
					if(rs.errno!=0){
						console.log('shareinfo err rs:', rs);
					}
					if(callback){
						callback(null, rs);
					}
				},(err)=>{
					if(retry_cnt < max_retry_cnt){
						console.log('fetch_file_list_by_fid to retry call:', err);
						setTimeout(()=>{re_call_fun(retry_cnt+1);}, 1000 + retry_cnt * 100);
					} else {
						if(callback){
							callback("failed", null);
						}
					}
				});
			}
			re_call_fun(0);
			
		}
	}
	window.baidu_api = baidu_api;
	
	function next_check_save_btn(){
		var __options={'root':{'tag':'div.sharelist-operate', 'attrs':{'node-type':'sharelist-operate'}},
		'parent':{'tag':'div.sharelist-operate-btns'},
		'attrs':{'node-type':'btn-operate', 'data-key':'transfer'},
		'tag':'a.global-btn-transfer',
		};
		to_find_group_btn(__options, (elems)=>{
			console.log('save btn elems:', elems);
			if(elems && elems.length>0){
				var nav = elems[0];
				window.save_btn = nav;
				// var btn=document.createElement("BUTTON");
				// // btn.value='动态导入';
				// btn.innerHTML = '动态导入';
				// nav.appendChild(btn);
				// btn.onclick=function(e){alert('hello!');};
			}
		});
	}
	
	window.test=function(){
		alert('hello!');
	}
	console.log('hello i am here!');
	function getElementAbsoluteOffsetTop(element){
	  var absolute_offset_top = element.offsetTop;
	  var absolute_offset_left = element.offsetLeft;
	  var parent_node = element.offsetParent;
	  while(parent_node != null){
	    absolute_offset_top += parent_node.offsetTop; 
		absolute_offset_left += parent_node.offsetLeft; 
	    parent_node = parent_node.offsetParent; 
	  }
	  return {x:absolute_offset_left, y:absolute_offset_top};
	}
	// function check_share_btn(cb){
	// 	var elements = document.querySelectorAll('a[title=分享]');
	// 	if(elements){
	// 		for(var i=0;i<elements.length;i++){
	// 			var sa = elements[i];
	// 			if(sa.getAttribute('node-type')=='item-title'){
	// 				if(cb){
	// 					cb(sa);
	// 				}
	// 				return;
	// 			}
	// 		}
	// 	}
	// }
	// window.__stat_spider=function(){
	// 	var elements = document.querySelectorAll('a[title=分享]');
	// 	var target_sa = null;
	// 	if(elements){
	// 		for(var i=0;i<elements.length;i++){
	// 			var sa = elements[i];
	// 			if(sa.getAttribute('node-type')=='item-title'){
	// 				window.target_sa=sa;
	// 				target_sa = sa;
	// 				var rect = getElementAbsoluteOffsetTop(sa);
	// 				rect.width = sa.offsetWidth;
	// 				rect.height = sa.offsetHeight;
	// 				console.log('rect:', rect);
	// 				var scrollX = (((t = document.documentElement) || (t = document.body.parentNode))
	// 				 && typeof t.scrollLeft == 'number' ? t : document.body).scrollLeft;
	// 				var scrollY = (((t = document.documentElement) || (t = document.body.parentNode))
	// 				 && typeof t.scrollTop == 'number' ? t : document.body).scrollTop;
	// 				 if(!scrollX)scrollX = 0;
	// 				 if(!scrollY)scrollY = 0;
	// 				 rect.x += scrollX;
	// 				 rect.y += scrollY;
					 
	// 				ipcRenderer.send('asynchronous-spider-backend', {"tag":"found","target":'shared'});
	// 				target_map['shared'] = sa;
	// 				// sa.click();
	// 				return;
	// 			}
	// 		}
	// 	}
		
	// 	if(!target_sa){
	// 		setTimeout(__stat_spider, 1000);
	// 	}
	// }
	function check_attrs(attrs_keys, attrs, element){
		for(var i=0;i<attrs_keys.length;i++){
			var val = attrs[attrs_keys[i]];
			var a_val = element.getAttribute(attrs_keys[i]);
			if(!a_val||!a_val.startsWith(val)){
				return false;
			}
		}
		return true;
	}
	function fetch_element_until_fetched(options, cb, counter, until){
		console.log('fetch_element_until_fetched start until:', until);
		var rs = null;
		var _options = {};
		if(!counter)counter=0;
		helpers.extend(_options, options);
		var root_element_options = options['root'];
		var all_roots = [document];
		if(root_element_options){
			var selector_val = root_element_options.tag;
			var attrs = root_element_options.attrs;
			if(attrs){
				for(var k in attrs){selector_val += '['+k+'|="'+attrs[k]+'"]';}
			}
			console.log("root selector_val:", selector_val);
			all_roots = document.querySelectorAll(selector_val);
		}
		for(var i=0;i<all_roots.length;i++){
			fetch_element(options, all_roots[i], (elems)=>{
				if(elems){rs = elems;}
			});
			if(rs){break;}
		}
		var delay = 1000+counter*100;
		if(!rs || rs.length==0){
			if(counter > 23){
				var rs = false;
				console.log('until:', until);
				if(until){
					rs = true;
				} else {
					rs = confirm("元素位置解析失败! 单击“确定”重新解析。单击“取消”停止解析。");
				}
				if(rs){
					counter = 0;
					delay = 1000+counter*100;
					setTimeout(()=>{fetch_element_until_fetched(_options, cb, counter, until)}, delay);
				} else {
					cb([]);
				}
			} else {
				if(delay > 3000){
					delay = 3000;
				}
				setTimeout(()=>{fetch_element_until_fetched(_options, cb, counter+1, until)}, delay);
			}
		} else {
			cb(rs);
		}
		return rs;
		
	}
	function to_find_group_btn(options, cb, counter){
		fetch_element_until_fetched(options, cb, counter, false);
	}
	window.to_find_group_btn = to_find_group_btn;
	function fetch_element(options, root_element, cb){
		var target_group_a = null;
		if(!root_element){
			root_element = document;
		}
		var parent_options = options['parent'];
		if(parent_options){
			delete options['parent'];
			// console.log('parent_options:', parent_options);
			fetch_element(parent_options, document, (elems)=>{
				if(elems){
					var pos = 0;
					var re_cal = (pos)=>{
						if(pos>=elems.length){
							cb(null);
							return;
						}
						var _elem = elems[pos];
						fetch_element(options, _elem, (_elems)=>{
							if(_elems && _elems.length>0){
								cb(_elems);
							} else {
								re_cal(pos+1);
							}
						});
					}
					re_cal(0);
					// elems.forEach((_el, idx)=>{
					// 	fetch_element(options, elem, cb)
					// });
				} else {
					if(cb)cb();
				}
			});
		} else {
			var child_options = options['child'];
			var tag = options['tag'];
			var attrs = options['attrs'];
			var selector_val = tag;
			var all_ks = [];
			if(attrs){
				var first_attr = null;
				for(var k in attrs){
					if(!first_attr){
						first_attr = k;
					} else {
						all_ks.push(k);
					}
				}
				if(first_attr){
					selector_val += '['+first_attr+'|="'+attrs[first_attr]+'"]';
					// selector_val = selector_val+"["+first_attr+"|="+attrs[first_attr]+"]";
				}
			}
			window.root_element = root_element;
			var elements = root_element.querySelectorAll(selector_val);
			// console.log('fetch_element selector_val:', root_element, selector_val, elements.length);
			// console.log('fetch_element selector_val:', selector_val, elements.length);
			
			var filter_elements = [];
			if(elements && elements.length>0){
				for(var i=0;i<elements.length;i++){
					var el = elements[i];
					if(all_ks && all_ks.length>0){
						if(check_attrs(all_ks, attrs, el)){
							filter_elements.push(el);
						}
					} else {
						filter_elements.push(el);
					}
				}
			} else {
				console.log('can not find element: by root=>', root_element, ' [query] ', selector_val);
			}
			if(child_options){
				var pos = 0;
				var by_child_filter_elements = [];
				var re_cal = (pos)=>{
					if(pos>=filter_elements.length){
						return;
					}
					var _elem = filter_elements[pos];
					fetch_element(child_options, _elem, (_elems)=>{
						if(_elems && _elems.length>0){
							// console.log('_elems:', _elems);
							by_child_filter_elements.push(_elem);
						}
						re_cal(pos+1);
					});
				}
				re_cal(0);
				// console.log('by_child_filter_elements:', by_child_filter_elements);
				if(cb){cb(by_child_filter_elements);}
			}else{
				if(cb){cb(filter_elements);}
			}
		}
		
		// if(!target_group_a){
		// 	setTimeout(function(){fetch_element(options, root_element, cb)}, 1000);
		// }
	}
	//////////////////////////////////
	var valid_check_boxs = (parent_node, cb)=>{
		var all_fids = parent_node.querySelectorAll('li.on');
		if(all_fids && all_fids.length>0){
			var fid_list = [];
			var isdir_map = {};
			all_fids.forEach((li_obj, idx)=>{
				var dt = li_obj.dataset;
				if(dt && dt.hasOwnProperty('fid')){
					isdir_map[dt.fid]=0;
					fid_list.push(dt.fid);
					var desc_obj = li_obj.querySelector('a[data-dir]');
					if(desc_obj){
						isdir_map[dt.fid] = parseInt(desc_obj.dataset.dir);
					}
				}
			});
			cb(fid_list, isdir_map);
		} else {
			cb(null, null);
		}
		
	};
	
	//////////////////////come from baidu
	var baidu_api = function() {
		var e = function(e) {
			var t = /^[\],:{}\s]*$/,
			n = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,
			r = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
			a = /(?:^|:|,)(?:\s*\[)+/g;
			if ("object" == typeof e) return e;
			if ("string" != typeof e || !e) return null;
			if ("string" == typeof e && (e = e.replace(/(^\s*|\s*$)/g, "")), t.test(e.replace(n, "@").replace(r, "]").replace(a, ""))) return window.JSON && window.JSON.parse ? window.JSON.parse(e) : new Function("return " + e)();
			throw new Error("Invalid JSON: " + e)
		},
		t = function(t, n, r) {
			var a;
			a = window.XMLHttpRequest ? new XMLHttpRequest: new ActiveXObject("Microsoft.xhr"),
			a.open("GET", t, !0),
			a.onreadystatechange = function() {
				if (4 == a.readyState) {
					var t = {};
					try {
						t = e(a.responseText)
					} catch(o) {}
					200 == a.status ? "function" == typeof n && n(t) : "function" == typeof r && r(t)
				}
			},
			a.send()
		},
		tp = function(url, type, datas, succ, failed) {
			var a = window.XMLHttpRequest ? new XMLHttpRequest: new ActiveXObject("Microsoft.xhr"),
			body = null;
			a.open("POST", url, !0);
			if (type === "formdata") {
				body = new FormData();
				for(var k in datas){
					body.append(k, datas[k]);
				}
			} else if (type === "json") {
				xhr.setRequestHeader("Content-Type", "application/json");
				body = JSON.stringify(datas);
			} else if (type === "text") {
				body = _build_get_url('', datas);
			} else if (type === "www") {
				xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
				body = _build_get_url('', datas);
			}
			a.onreadystatechange = function() {
				if (4 == a.readyState) {
					var t = {};
					try {
						t = e(a.responseText)
					} catch(o) {}
					200 == a.status ? "function" == typeof succ && succ(t) : "function" == typeof failed && failed(t)
				}
			}
			a.send(body);
		},
		n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/~！@#￥%……&",
		r = String.fromCharCode,
		a = function(e) {
			if (e.length < 2) {
				var t = e.charCodeAt(0);
				return 128 > t ? e: 2048 > t ? r(192 | t >>> 6) + r(128 | 63 & t) : r(224 | t >>> 12 & 15) + r(128 | t >>> 6 & 63) + r(128 | 63 & t)
			}
			var t = 65536 + 1024 * (e.charCodeAt(0) - 55296) + (e.charCodeAt(1) - 56320);
			return r(240 | t >>> 18 & 7) + r(128 | t >>> 12 & 63) + r(128 | t >>> 6 & 63) + r(128 | 63 & t)
		},
		o = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g,
		c = function(e) {
			return (e + "" + Math.random()).replace(o, a)
		},
		i = function(e) {
			var t = [0, 2, 1][e.length % 3],
			r = e.charCodeAt(0) << 16 | (e.length > 1 ? e.charCodeAt(1) : 0) << 8 | (e.length > 2 ? e.charCodeAt(2) : 0),
			a = [n.charAt(r >>> 18), n.charAt(r >>> 12 & 63), t >= 2 ? "=": n.charAt(r >>> 6 & 63), t >= 1 ? "=": n.charAt(63 & r)];
			return a.join("")
		},
		d = function(e) {
			return e.replace(/[\s\S]{1,3}/g, i)
		},
		l = function() {
			return d(c((new Date).getTime()))
		},
		u = function(e, t) {
			return t ? l(String(e)).replace(/[+\/]/g,
			function(e) {
				return "+" == e ? "-": "_"
			}).replace(/=/g, "") : l(String(e))
		},
		f = function(e) {
			var t, n;
			return document.cookie.length > 0 && (t = document.cookie.indexOf(e + "="), -1 != t) ? (t = t + e.length + 1, n = document.cookie.indexOf(";", t), -1 == n && (n = document.cookie.length), decodeURI(document.cookie.substring(t, n))) : ""
		},
		h = function(e) {
			var t = new RegExp(e + "=([^#&]*)", "g"),
			n = t.exec(location.hash);
			return n ? decodeURIComponent(n[1]) : ""
		},
		p = function(e, n, r, a, o) {
			t(e,
			function(e) {
				if (0 === e.errno) {
					window.cache || (window.cache = {});
					var t = window.cache;
					t[r] || (t[r] = {},
					t[r].writeable = !0),
					t[r].data || (t[r].data = {}),
					t[r].data[n] ? t[r].data[n][a] instanceof Array && Array.prototype.push.apply(t[r].data[n][a], e[o]) : (t[r].data[n] = {},
					t[r].data[n][a] = e[o]),
					t[r].data[n].hasMore = !1,
					e[o] && e[o].length >= w && (t[r].data[n].hasMore = !0),
					"undefined" == typeof e.hasMore || e.hasMore || (t[r].data[n].hasMore = !1),
					t[r].data[n].share = e.share ? 1 : 0
				}
				window.prefetchEnable = !1,
				window.prefetchCallback()
			},
			function() {
				window.prefetchEnable = !1,
				window.prefetchCallback()
			})
		},
		s = function(e) {
			var t = "localorder_" + (e || "").replace(/@/g, "");
			if (y) {
				var n, r = localStorage.getItem(t),
				a = h("type");
				return a && "3" === a ? null: r && 2 === r.split("_").length ? (n = r.split("_"), {
					item: n[0],
					desc: parseInt(n[1], 10)
				}) : null
			}
		},
		g = !1,
		w = 100,
		y = function() {
			try {
				window.localStorage.setItem("localStorageCall", "true")
			} catch(e) {
				return ! 1
			}
			return localStorage && "function" == typeof localStorage.getItem
		} ();
		/*
		window.initPrefetch = function(e, t) {
			if (!g) {
				g = !0;
				var n = "",
				r = "",
				a = "",
				o = (location.hash.match(/#\/([^?\/]+)/) || [])[1],
				c = "list",
				i = "";
				if ("category" === o ? (a = "category", n = "/api/categorylist", r = h("type"), n += "?category=" + encodeURIComponent(r), i = "info") : "all" === o && (n = "/api/list", r = h("path"), r = r ? r: "/", a = "list", n += "?dir=" + encodeURIComponent(r), i = "list"), n) {
					window.prefetchEnable = !0,
					window.prefetchCallback = function() {};
					var d = s(t);
					n += "&bdstoken=" + e,
					n += "&logid=" + u(f("BAIDUID")),
					n += "&num=" + w,
					d ? (n += "&order=" + (d.item || "time"), n += "&desc=" + ("number" == typeof d.desc ? d.desc: 1)) : n += "&order=time&desc=1",
					n += "&clienttype=0&showempty=0&web=1&page=1&channel=chunlei&web=1&app_id=250528",
					p(n, r, a, c, i)
				}
			}
		}
		*/
		
		return {
			'build_log_id':()=>{
				return u(f("BAIDUID"));
			},
			'get_req':(url, success_fun, error_fun)=>{
				t(url, (e)=>{
					if (success_fun) {
						success_fun(e);
					}
				}, (err)=>{if(error_fun)error_fun(err);});
			},
			'post_req':(url, datas, type, success_fun, error_fun)=>{
				tp(url, type, datas, (e)=>{
					if (success_fun) {
						success_fun(e);
					}
				}, (err)=>{if(error_fun)error_fun(err);});
			}
		}
	} ();
	
}

