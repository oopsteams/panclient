const {BrowserWindow, ipcMain, session} = require('electron');
const request = require('request');
const helpers = require("./helper.core.js")
const Base = require("./base.js")
const Dao = require('./dao.js')
const transfer_bulk_size = 499;
let point = helpers.point;
var file_list_db = new Dao({'type':'list', 'name':'file_list', 
'fields':[{name:"id", type:'VARCHAR', len:20},
		{name:"category", type:'INT'},
		{name:"parent", type:'VARCHAR', len:20},
		{name:"isdir", type:'INT'},
		{name:"filename", type:'VARCHAR', len:512},
		{name:"path", type:'VARCHAR', len:1024},
		{name:"size", type:'INT'},
		{name:"pin", type:'INT'},
		{name:"synced", type:'INT'},
		{name:"server_ctime", type:'INT'},
		{name:"server_mtime", type:'INT'},
		{name:"tm", type:'INT'},
		{name:"root_id", type:'VARCHAR', len:20},
		{name:"app_id", type:'INT'},
		{name:"task_id", type:'INT'},
	]
});
/*
pin=> 0:init; 1:scan over; 2:start transfer; 5:transfered ok; 9:deleted;
*/
var transfer_tasks_db = new Dao({'type':'list', 'name':'transfer_tasks', 
'fields':[{name:"id", type:'INT'},
		{name:"path", type:'VARCHAR', len:1024},
		{name:"name", type:'VARCHAR', len:256},
		{name:"from_uk", type:'VARCHAR', len:64},
		{name:"msg_id", type:'VARCHAR', len:64},
		{name:"gid", type:'VARCHAR', len:64},
		{name:"stype", type:'INT'},
		{name:"target_path", type:'VARCHAR', len:1024},
		{name:"pin", type:'INT'},
		{name:"num", type:'INT'},
		{name:"dirnum", type:'INT'},
		{name:"app_id", type:'INT'},
		{name:"target_type", type:'VARCHAR', len:32}
	]
});
var transfer_dirs_db = new Dao({'type':'list', 'name':'transfer_dirs', 
'fields':[{name:"id", type:'VARCHAR', len:512},
		{name:"fs_id", type:'VARCHAR', len:20},
		{name:"pin", type:'INT'},
		{name:"task_id", type:'INT'},
		{name:"app_id", type:'INT'}
	]
});
var transfer_root_file_db = new Dao({'type':'list', 'name':'transfer_root_file', 
'fields':[{name:"id", type:'VARCHAR', len:20},
		{name:"fs_id", type:'VARCHAR', len:20},
		{name:"msg_id", type:'VARCHAR', len:20},
		{name:"gid", type:'VARCHAR', len:64},
		{name:"from_uk", type:'VARCHAR', len:64},
		{name:"path", type:'VARCHAR', len:1024},
		{name:"name", type:'VARCHAR', len:256},
		{name:"task_id", type:'INT'}
	]
});

function call_pansite_by_post(token, point, path, jsondata, callback){
	var headers = {"SURI-TOKEN": token, "Content-Type": "application/json"};
	var content = JSON.stringify(jsondata);
	var options = {
		method: 'POST',
		url: point + path,
		followRedirect: false,
		followOriginalHttpMethod: true,
		timeout: 120000,
		strictSSL: false,
		headers: headers
	};
	var req = request(options, function(error, response, body){
		var json_obj = JSON.parse(body);
		if(!json_obj){
			callback({"state": -1, "msg":"account not exist!"})
			return;
		} else {
			callback(json_obj)
		}
	});
	req.write(content);
	req.end();
}

var fetch_file_list_helper = Base.extend({
	constructor:function(context, options){
		this.context = context;
		this.options = options;
		this.cache = {};
	},
	sync_to_es:function(task_id){
		var self = this;
		//1576237032676
		// task_id = 1576237032676
		// task_id = 1576215032981;
		// task_id = 1576899115989;
		var path = "source/synccommunity";
		
		var datas = [{id:1,name:'test'},{id:2,name:'test2'}];
		var page_size = 100;
		var counter = 0;
		var fetch_datas = (token, tt_id, app_id, offset)=>{
			if(!offset){
				offset = 0;
			}
			var final_fun = (file_list, has_more)=>{
				var file_list_ids = [];
				file_list.forEach((f, idx)=>{file_list_ids.push(f.id);});
				var sql="update file_list set synced=2 where id in('"+file_list_ids.join("','")+"')" ;
				// console.log('final update file_list sql:', sql);
				file_list_db.update_by_raw_sql(sql, (result)=>{
					if(has_more){
						setTimeout(()=>{fetch_datas(token, tt_id, app_id, offset);},1);
					}
				});
			};
			file_list_db.query_mult_params({'task_id': tt_id, 'app_id': app_id, 'synced':0, 'isdir':1}, (file_list)=>{				
				if(file_list.length>0){
					counter = counter + 1;
					var file_list_ids = [];
					file_list.forEach((f, idx)=>{file_list_ids.push(f.id);});
					var sql="update file_list set synced=1 where id in('"+file_list_ids.join("','")+"')" ;
					// console.log('ready update file_list sql:', sql);
					file_list_db.update_by_raw_sql(sql, (result)=>{
						// console.log('updated result:', result);
						if(file_list.length < page_size){
							sync_datas_to_es(token, tt_id, app_id, file_list,(res)=>{
								console.log("fetch the last ["+counter * page_size+"] res:", res);
								final_fun(file_list, false);
							});
						} else if(file_list.length == page_size){
							sync_datas_to_es(token, tt_id, app_id, file_list,(res)=>{
								console.log("fetch["+counter * page_size+"] res:", res);
								final_fun(file_list, true);
								// setTimeout(()=>{fetch_datas(token, tt_id, app_id, offset+page_size);},1);
							});
						}
						
					});
				}
				
				// console.log("file_list:", file_list);
			}, page_size, offset);
		};
		
		var sync_datas_to_es = (token, tt_id, app_id, file_list, cb)=>{
			var params = {
				"source": "shared",
				"sourceid": app_id,
				"sourceuid": tt_id,
				"datas": file_list
			};
			call_pansite_by_post(token, point, path, params, (res)=>{
				if(cb){
					cb(res);
				}
			});
		};
		
		self.context.account.get_valid_token((token)=>{
			if(token){
				transfer_tasks_db.query_mult_params({"id": task_id},(tts)=>{
					if(tts && tts.length>0){
						var _tt = tts[0];
						var app_id = _tt.app_id;
						var git = _tt.gid;
						fetch_datas(token, _tt.id, app_id, 0)
					}
				});
			}
		});
		
	},
	update_options:function(key, value){
		this.options[key] = value;
	},
	fetch_sub_file_list_by_task:function(task){
		var self = this;
		var app_id = task.app_id;
		var task_id = task.id;
		var sender = this.context.win.webContents;
		file_list_db.query_mult_params({'task_id': task_id, 'isdir':0, 'app_id': app_id, 'pin': 0}, (file_list)=>{
			if(file_list && file_list.length>0){
				var file = file_list[0];
				self.context.log('file:', file);
				file_list_db.update_by_id(file.id, {'pin': 4}, function(){
					self.fetch_root_item(task, file.root_id, (root_item)=>{
						setTimeout(()=>{
							sender.send('asynchronous-spider', {'tag':'start_transfer', 'parent_item': {'id':file.parent}, 'file':file, 'task': task, 'root_item':root_item});
						}, 100);
					});
				});
			} else {
				file_list_db.query_count({'task_id': task_id, 'isdir':0, 'app_id': app_id, 'pin': 5},(cnt_row)=>{
					if(cnt_row){
						var total_cnt = cnt_row.cnt;
						// delete task['doing'];
						if(task.num == total_cnt){
							transfer_tasks_db.update_by_id(task_id, {'pin': 5}, ()=>{
								self.check_ready((tasks)=>{
									self.context._dialog(tasks);
								});
							});
						} else {
							self.check_ready((tasks)=>{
								self.context._dialog(tasks, (open_win)=>{
									self.context.popwin_send({'tag':'progress',
										'id': task.id,
										'over': false,
										'task': task,
										'err':'存在转存失败文件,请尝试重新转存!'
									});
								});
							});
						}
					}
				});
				
			}
		}, 1);
	},
	test_recursive:function(task_id, folder_id){
		var self = this;
		transfer_tasks_db.query_mult_params({'id': task_id}, (tasks)=>{
			if(tasks&&tasks.length>0){
				var _t = tasks[0];
				file_list_db.query_mult_params({'task_id': task_id, 'app_id': _t.app_id, 'id':folder_id}, (_folders)=>{
					console.log(_folders);
					if(_folders&&_folders.length>0){
						var ff = _folders[0];
						self.recursive_count_folder_file(_t, ff, (my_bulk, main_folder)=>{
										
							console.log('my_bulk:',my_bulk);
							console.log('main_folder:',main_folder);
							
						});
					}
				});
			}
		});
	},
	
	recursive_count_folder_file:function(task, folder_file, out_cb){
		var self = this;
		var app_id = task.app_id;
		var task_id = task.id;
		folder_file.size = 0;
		folder_file.total = 0;
		folder_file.sub_folders = [];
		var get_count=(main_folder_file, sub_folders, pos, callback)=>{
			if(pos>=sub_folders.length){
				self.context.log('pos >= length:',pos, sub_folders.length);
				callback(true, main_folder_file);
				return;
			}
			// console.log('main_folder_file.total > transfer_bulk_size',main_folder_file.total,transfer_bulk_size);
			if(main_folder_file.total+main_folder_file.sub_folders.length > transfer_bulk_size){
				//callback can not bulk
				self.context.log('main_folder_file.total > transfer_bulk_size:', main_folder_file.total, main_folder_file.sub_folders.length, transfer_bulk_size);
				callback(false, main_folder_file);
			} else {
				var __folder_file = sub_folders[pos];
				file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'parent':__folder_file.id},(cnt_row)=>{
					
					var total_cnt = cnt_row.cnt;
					if(total_cnt>transfer_bulk_size || total_cnt == 0){
						//callback can not bulk
						self.context.log('total_cnt > transfer_bulk_size or total_cnt is 0:', total_cnt);
						callback(false, main_folder_file);
						return;
					} else {
						file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'parent':__folder_file.id, 'isdir':0, 'pin':0},(fcnt_row)=>{
							
							var file_cnt = fcnt_row.cnt;
							
							if(total_cnt > file_cnt){
								file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'parent':__folder_file.id, 'isdir':1, 'pin':3},(all_fcnt_row)=>{
									var file_folder_cnt = all_fcnt_row.cnt;
									if(file_folder_cnt == 0){//have folder pin not equal 0
										//callback can not bulk
										self.context.log('file_folder_cnt is 0,have folder pin not equal 0');
										callback(false, main_folder_file);
									} else if(file_folder_cnt+file_cnt == total_cnt){
										//recursive count
										query_sub_folders(__folder_file.id, task_id, app_id, (_sub_folders)=>{
											_sub_folders.forEach((sf, index)=>{main_folder_file.sub_folders.push(sf)});
											update_size_count(__folder_file.id, task_id, app_id,(sub_size)=>{
												main_folder_file.total += file_cnt;
												main_folder_file.size += sub_size;
												// console.log('recursive to fetch sub folder:', _sub_folders);
												if(main_folder_file.total+main_folder_file.sub_folders.length > transfer_bulk_size){
													//callback can not bulk
													self.context.log('main_folder_file.total > transfer_bulk_size:', main_folder_file.total, main_folder_file.sub_folders.length, transfer_bulk_size);
													callback(false, main_folder_file);
												} else {
													get_count(main_folder_file, _sub_folders, 0, (come_on, _main_folder_file)=>{
														if(come_on){
															get_count(main_folder_file, sub_folders, pos+1, callback);
														} else {
															callback(false, main_folder_file);
														}
													});
												}
												
											});
										});
										
									} else {//part file&folder pin not equal 0
										//callback can not bulk
										self.context.log('file_folder_cnt != total_cnt:', file_folder_cnt, total_cnt);
										callback(false, main_folder_file);
									}
								});
							} else {
								// total_cnt size
								// console.log('total_cnt == file_cnt, will update_size_count:',file_cnt, total_cnt);
								update_size_count(__folder_file.id, task_id, app_id,(sub_size)=>{
									main_folder_file.total += file_cnt;
									main_folder_file.size += sub_size;
									if(main_folder_file.total+main_folder_file.sub_folders.length > transfer_bulk_size){
										//callback can not bulk
										self.context.log('main_folder_file.total > transfer_bulk_size:', main_folder_file.total, main_folder_file.sub_folders.length, transfer_bulk_size);
										callback(false, main_folder_file);
									} else {
										get_count(main_folder_file, sub_folders, pos+1, callback);
									}
								});
							}
						});
					}
					
					
				});
			}
			
		};
		var update_size_count=(parent_id, task_id, app_id, cb)=>{
			file_list_db.query_sum('size', {'parent':parent_id, 'task_id':task_id, 'app_id': app_id, 'isdir':0}, (sum_row)=>{
				if(cb){
					cb(sum_row.val)
				}
			});
		};
		var query_sub_folders=(parent_id, task_id, app_id, cb)=>{
			file_list_db.query_mult_params({'task_id': task_id, 'app_id': app_id, 'parent':parent_id, 'isdir':1}, (_sub_folders)=>{
				if(cb){
					if(_sub_folders && _sub_folders.length>0){
						cb(_sub_folders);
					} else {
						cb([]);
					}
				}
			});
		};
		get_count(folder_file,[folder_file], 0, (may_bulk, main_folder_file)=>{
			if(out_cb){
				out_cb(may_bulk, main_folder_file);
			}
		});
	},
	fetch_sub_file_list:function(task, parent_item){
		var self = this;
		var app_id = task.app_id;
		var task_id = task.id;
		var sender = this.context.win.webContents;
		var need_one_by_one = false;
		if(task.hasOwnProperty('one_by_one')){
			need_one_by_one = task.one_by_one;
		}
		if(parent_item.pin != 4){
			file_list_db.update_by_id(parent_item.id, {'pin': 4, 'tm':helpers.now()}, function(){
				parent_item.pin = 4;
				new_check_bulk_conditions();
			});
		} else {
			new_check_bulk_conditions();
		}
		function recursive_update_folder_sub_file(pos, folders, cb){
			if(pos<folders.length){
				var folder = folders[pos];
				file_list_db.update_by_id(folder.id, {'pin': 4, 'tm':helpers.now()+pos}, function(){
					folder.pin = 4;
					file_list_db.update_by_conditions({'parent':folder.id, 'task_id':task_id, }, {'pin': 2}, function(){
						recursive_update_folder_sub_file(pos+1, folders, cb);
					});
				});
			} else {
				if(cb){
					cb();
				}
			}
		}
		function new_check_bulk_conditions(){
			if(parent_item.hasOwnProperty('must_one_by_one') && parent_item.must_one_by_one){
				one_by_one();
			} else {
				self.recursive_count_folder_file(task, parent_item, (may_bulk, main_folder)=>{
					if(may_bulk){
						self.context.log('bulk transfer:', main_folder.filename, ',file count:', main_folder.total,', folder count:', main_folder.sub_folders.length, ',size:',helpers.scale_size(main_folder.size));
						recursive_update_folder_sub_file(0, [main_folder].concat(main_folder.sub_folders),()=>{
							self.fetch_root_item(task, parent_item.root_id, (root_item)=>{
								setTimeout(()=>{
									sender.send('asynchronous-spider', {'tag':'start_transfer', 'parent_item': parent_item, 'file':parent_item, 'task': task, 'root_item':root_item});
								}, 100);
							});
						});
					} else {
						parent_item.must_one_by_one = true;
						one_by_one();
					}
				});
			}
		}
		
		function one_by_one(){
			file_list_db.query_mult_params({'parent': parent_item.id, 'task_id':task_id, 'isdir':0, 'app_id': app_id, 'pin': 0}, (file_list)=>{
				if(file_list && file_list.length>0){
					var file = file_list[0];
					self.context.log('fetch_sub_file_list file:', file.filename);
					file_list_db.update_by_id(file.id, {'pin': 4}, function(){
						self.fetch_root_item(task, file.root_id, (root_item)=>{
							setTimeout(()=>{
								sender.send('asynchronous-spider', {'tag':'start_transfer', 'parent_item': parent_item, 'file':file, 'task': task, 'root_item':root_item});
							}, 100);
						});
						
						
					});
				} else {
					next_step();
				}
			}, 1);
		}
		
		
		function next_step(){//when single file transfer.
			file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'parent':parent_item.id, 'isdir':0},(fcnt_row)=>{
				if(fcnt_row){
					var file_count = fcnt_row.cnt;
					parent_item['file_count'] = file_count;
					check_folder_over_file_cnt(file_count);
				} else {
					self.transfer(task);
				}
			});
		}
		function check_folder_over_file_cnt(file_count){
			file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'parent':parent_item.id, 'isdir':0, 'pin':5},(fcnt_row)=>{
				if(fcnt_row){
					var over_file_count = fcnt_row.cnt;
					if(file_count == over_file_count){
						file_list_db.update_by_id(parent_item.id, {'pin': 5, 'tm':helpers.now()}, function(){
							self.transfer(task);
						});
					} else {
						self.transfer(task);
					}
				} else {
					self.transfer(task);
				}
			});
		}
		
	},
	on_transfer_continue:function(args, failed){
		var self = this;
		var parent_item= args.parent_item, file=args.file, task= args.task;
		var task_id = task.id;
		function recursive_update_folder_sub_file(pos, folders, cb){
			if(pos<folders.length){
				var folder = folders[pos];
				file_list_db.update_by_id(folder.id, {'pin': 5, 'tm':helpers.now()}, function(){
					folder.pin = 5;
					file_list_db.update_by_conditions({'parent':folder.id, 'task_id':task_id}, {'pin': 5}, function(){
						recursive_update_folder_sub_file(pos+1, folders, cb);
					});
				});
			} else {
				if(cb){
					cb();
				}
			}
		}
		if(file.isdir == 1){
			// console.log('bulk transfer file:', file.path);
			if(failed){
				self.context.log('dir tranfer failed!:', file.path);
				// file_list_db.update_by_id(file.id, {'pin': 6}, function(){
				// 	self.transfer(task);
				// });
				self.transfer(task);
				return;
			} else {
				self.context.log('recursive_update_folder_sub_file sub_folders:', file.sub_folders.length);
				recursive_update_folder_sub_file(0, [file].concat(file.sub_folders),()=>{
					if(file.hasOwnProperty('total')){
						var cnt = file['total'];
						if(task.hasOwnProperty('over_count')){
							task['over_count'] = task['over_count'] + cnt;
							self.context.popwin_send({'tag':'progress',
								'id': task.id,
								'over': task['over_count'] == task['total_count'],
								'task': task
							});
						}
					}
					self.transfer(task);
				});
			}
		} else {
			if(failed){
				self.context.log('file tranfer failed!:', file.path);
				// file_list_db.update_by_id(file.id, {'pin': 6}, function(){
				// 	self.fetch_sub_file_list(task, parent_item);
				// });
				self.fetch_sub_file_list(task, parent_item);
				return;
			} else {
				file_list_db.update_by_id(file.id, {'pin': 5}, function(){
					// console.log('file tranfer ok!:', file.path);
					var cnt = 1;
					if(task.hasOwnProperty('over_count')){
						task['over_count'] = task['over_count'] + cnt;
						self.context.popwin_send({'tag':'progress',
							'id': task.id,
							'over': task['over_count'] == task['total_count'],
							'task': task
						});
					}
					self.fetch_sub_file_list(task, parent_item);
				});
			}
		}
	},
	start_to_transfer:function(task, retry){
		var self = this;
		if(task.hasOwnProperty('doing')&&task.doing){
			return;
		} else {
			task.doing = true;
		}
		self.transfer(task, retry);
	},
	transfer:function(task,retry){
		var self = this;
		var task_id = task.id;
		var app_id = task.app_id;
		if(retry){
			task.retry=true;
			file_list_db.update_by_conditions({'pin':4, 'task_id':task_id, 'isdir':1}, {'pin': 3}, function(){
				file_list_db.update_by_conditions({'pin':4, 'task_id':task_id, 'isdir':0}, {'pin': 0}, function(){
					file_list_db.update_by_conditions({'pin':2, 'task_id':task_id, 'isdir':0}, {'pin': 0}, function(){
						transfer_tasks_db.update_by_id(task_id, {'pin': 2}, ()=>{
							task.pin = 2;
							check_sub_file(task_id);
						});
					})
				})
			});
		} else {
			transfer_tasks_db.update_by_id(task_id, {'pin': 2}, ()=>{
				task.pin = 2;
				check_sub_file(task_id);
			});
		}
		
		var check_sub_file = (task_id)=>{
			file_list_db.query_mult_params({'task_id': task_id, 'isdir':1, 'app_id': app_id, 'pin': 3}, (items)=>{
				if(items && items.length>0){
					var file_item = items[0];
					// console.log('dir fid:', file_item);
					self.fetch_sub_file_list(task, file_item);
					
					// sender.send('asynchronous-spider', {'tag':'transfer', 'parent_dir': parent_dir, 'fid_list':[file_item.id], 'target_dir': target_dir});
				} else {
					//TODO 查询最后的fileitem
					self.fetch_sub_file_list_by_task(task);
				}
			}, 1, 0, 'order by tm');
		};
	},
	del:function(task){
		var self = this;
		file_list_db.del('task_id', task.id, ()=>{
			transfer_root_file_db.del('task_id', task.id, ()=>{
				transfer_tasks_db.update_by_id(task.id,{'pin':9}, ()=>{
					self.check_ready((tasks)=>{
						self.context._dialog(tasks);
					});
				});
			});
		});
		
		
	},
	check_ready:function(callback){
		var self = this;
		function q_cnt(app_id, task_id, cb){
			file_list_db.query_count({'app_id': self.options.app_id, 'task_id':task_id, 'isdir':0},(cnt_row)=>{
				if(cnt_row){
					var total_cnt = cnt_row.cnt;
					file_list_db.query_count({'app_id': self.options.app_id, 'task_id':task_id, 'isdir':0, 'pin':5},(over_cnt_row)=>{
						var over_cnt = 0;
						if(over_cnt_row){
							over_cnt = over_cnt_row.cnt;
						}
						file_list_db.query_sum('size', {'task_id':task_id, 'isdir':0}, (sum_row)=>{
							if(sum_row){
								total_size = sum_row.val;
								if(cb){
									cb(over_cnt, total_cnt, total_size);
								}
							} else {
								cb(over_cnt, total_cnt, 0);
							}
						});
					});
				} else {
					cb(0, 0, 0);
				}
			});
		}
		var to_check_task_file_cnt=(_t, cb)=>{
			var app_id = _t.app_id;
			self._query_root_files(_t, (modified_task, root_files)=>{
				console.log('modified_task:', modified_task);
				q_cnt(app_id, modified_task.id, (o_cnt, t_cnt, total_size)=>{
					modified_task['over_count'] = o_cnt;
					modified_task['total_count'] = t_cnt;
					modified_task['total_size'] = total_size;
					if(modified_task.num != modified_task.total_count){
						modified_task.num = modified_task.total_count;
						transfer_tasks_db.update_by_id(modified_task.id,{'num': modified_task.num},()=>{
							cb();
						});
					} else {
						cb();
					}
				});
				
			});
			
		}
		transfer_tasks_db.query_mult_params({'app_id': this.options.app_id}, (items)=>{
			if(items){
				// callback(items);
				var re_call = (pos)=>{
					if(pos >= items.length){
						callback(items);
					} else {
						var _t = items[pos];
						if(_t.pin == 0){
							self.continue_scan_file_list(_t, (resume_breakpoint, task)=>{
								_t.resume_breakpoint=resume_breakpoint;
								to_check_task_file_cnt(_t, ()=>{
									re_call(pos+1);
								});
							});
						} else {
							to_check_task_file_cnt(_t, ()=>{
								re_call(pos+1);
							});
						}
					}
				};
				re_call(0);
			}
		});
	},
	check_dir_exist:function(options, app_id){
		//transfer_dirs_db.query
		var self = this;
		var args = {}
		var dir = '';
		var task = null;
		var task_id = 0;
		var need_one_by_one = false;
		if(typeof(options) == 'string'){
			dir = options;
		} else {
			args = options;
			var parent_item = args.parent_item, file=args.file, task= args.task;
			app_id = file.app_id;
			dir = file.path;
			if(task){
				task_id = task.id;
				if(task.hasOwnProperty('one_by_one')){
					need_one_by_one = task.one_by_one;
				}
			}
		}
		var _dir_idx = dir.lastIndexOf('/');
		if(_dir_idx>=0){
			dir = dir.substring(0, _dir_idx);
			if(task){
				to_check(task);
			} else {
				transfer_tasks_db.query_mult_params({'app_id': app_id}, (items)=>{
					if(items){
						if(task){
							helpers.extend(task, items[0]);
						} else {
							task = items[0];
						}
						to_check(task);
					}
				});
			}
			function to_check(task){
				var path = task.path;
				var target_path = task.target_path;
				var from_uk = task.from_uk;
				var msg_id = task.msg_id;
				var gid = task.gid;
				// console.log("check dir:", task.path, ' [TO] ', task.target_path, task.over_count, task.total_count, task.id);
				var idx = dir.indexOf(path);
				if(idx>=0){
					var target_suffix_dir = dir.substring(idx+path.length);
					// console.log('target_suffix_dir:', target_suffix_dir);
					var target_dir = target_path + target_suffix_dir;
					// console.log('target_dir:', target_dir);
					var sender = self.context.win.webContents;
					transfer_dirs_db.query_start_with_params({'id': target_dir, 'app_id':app_id}, (items)=>{
						if(items && items.length>0){
							// console.log('find the dir:', items);
							args.tag = 'to_transfer_confirm';
							args.target_dir = target_dir;
							sender.send('asynchronous-spider',args);
						} else {
							// console.log('can not find the dir:', dir);
							need_one_by_one = false; // optimize,skip mkdir
							if(need_one_by_one){
								var __args = {'dir':target_dir};
								helpers.extend(__args, args);
								__args.tag = 'check_self_dir';
								sender.send('asynchronous-spider',__args);
							} else {
								args.tag = 'to_transfer_confirm';
								args.target_dir = target_dir;
								sender.send('asynchronous-spider',args);
							}
							
						}
					});
					
				}
			}
		}
	},
	on_check_dir:function(args, cb){
		var rs = args.rs, dir = args.dir;
		var sender = this.context.win.webContents;
		var item = {
			id: dir,
			pin:0,
			fs_id:rs.hasOwnProperty('fs_id')?rs.fs_id:'',
			app_id:this.options.app_id
		}
		transfer_dirs_db.put(item, ()=>{
			if(cb){
				cb();
			}
			args.target_dir = dir;
			args.tag = 'to_transfer_confirm';
			sender.send('asynchronous-spider',args);
		});
	},
	fetch_root_item:function(task, root_id, cb){
		var self = this;
		var in_cb = (modified_task)=>{
			var file_items = modified_task.file_items;
			var root_item = file_items.hasOwnProperty(root_id)?file_items[root_id]:{};
			cb(root_item, modified_task);
		};
		if(!task.hasOwnProperty('file_items')){
			self._query_root_files(task, (modified_task, root_files)=>{
				in_cb(modified_task);
			});
		} else {
			in_cb(task);
		}
	},
	_query_root_files:function(task, cb){
		transfer_root_file_db.query_mult_params({'task_id':task.id},(items)=>{
			var _file_items = {}
			items.forEach((rf, idx)=>{
				_file_items[rf.id] = {
					id: rf.msg_id,
					gid: rf.gid,
					frm: rf.from_uk,
					fid: rf.fs_id,
					name: rf.name,
					path: rf.path
				};
			});
			task.file_items = _file_items;
			cb(task, items);
		});
	},
	check_out_task:function(params, parent_dir, target_dir, app_id, cb, has_records, task_name, target_type, file_items){
		var self = this;
		var path = parent_dir.join('/');
		var key = ''+app_id+'_'+path+'_'+task_name+'_'+target_dir;
		var msgid = params.msgid;
		var fromuk = params.fromuk;
		var _gid = params._gid;
		var stype = params.ftype;
		var check_root_items = (t, file_items, cb)=>{
			var all_root_items = [];
			if(file_items){
				for(var fid in file_items){
					var _item = file_items[fid];
					_item['tfid'] = fid;
					all_root_items.push(_item);
				}
				
				transfer_root_file_db.save_list_one_by_one(all_root_items,(new_item, _get_item, cb)=>{
					cb(new_item);
				},(r)=>{
					return {
						'id':r.tfid,
						'msg_id':r.id,
						'gid':r.gid,
						'from_uk':r.frm,
						'name':r.hasOwnProperty('name')?r.name:'',
						'path':r.hasOwnProperty('path')?r.path:'',
						'fs_id':r.fid,
						'task_id':t.id
					};
				},(_list)=>{
						console.log('root items save ok!', _list);
						cb(_list);
					});
			}
		};
		if(this.cache.hasOwnProperty(key) && this.cache[key]){
			
			cb(this.cache[key]);
		} else {
			transfer_tasks_db.query_mult_params({'path': path, 'app_id': app_id, 'name':task_name, 'target_dir': target_dir}, (items)=>{
				if(items && items.length>0){
					var __item = items[0];
					self.cache[key] = __item;
					var _next_ = ()=>{
						if(file_items){
							check_root_items(__item, file_items, ()=>{
								__item.file_items = file_items;
								cb(__item);
							});
						} else {
							self._query_root_files(__item, (modified_task, root_files)=>{
								cb(modified_task);
							});
						}
					};
					if(has_records){
						self.context.log('to update task:', __item);
						__item.pin = 0;
						transfer_tasks_db.update_by_id(__item.id, {'pin': 0}, ()=>{
							// cb(__item);
							_next_();
						});
					} else {
						// cb(__item);
						_next_();
					}
				} else {
					var item = {
						id: Date.now(),
						'path': path,
						'msg_id':msgid,
						'from_uk':fromuk,
						'gid':_gid,
						'target_path': target_dir,
						pin:0,
						num:0,
						dirnum:0,
						'name':task_name,
						'stype':stype,
						'app_id':app_id,
						'target_type':target_type
					}
					transfer_tasks_db.put(item, (_item)=>{
						check_root_items(_item, file_items, ()=>{
							_item.file_items = file_items;
							self.cache[key] = _item;
							cb(_item);
						});
					});
				}
			});
		}
	},
	continue_scan_file_list:function(task, callback){
		var self = this;
		var task_id = task.id;
		var app_id = task.app_id;
		// var target_dir = task.target_path;
		// var parent_dir = task.path.split('/');
		var sql="select count(a.id) as cnt from file_list a where a.task_id="+task_id+" and isdir=1 and exists(select b.id from file_list b where a.parent=b.id) limit 1";
		file_list_db.query_by_raw_sql(sql, (rows)=>{
			if(rows && rows.length>0){
				var cnt = rows[0].cnt;
				if(cnt>0){
					resume_breakpoint = true;
					to_fetch(true);
				} else {
					to_fetch(false);
				}
			} else {
				to_fetch(false);
			}
		});
		function to_fetch(resume_breakpoint){
			if(callback){
				callback(resume_breakpoint, task);
			}
		}
	},
	_to_continue_fetch:function(resume_breakpoint, task){
		var self = this;
		var task_id = task.id;
		var app_id = task.app_id;
		var target_dir = task.target_path;
		var parent_dir = task.path.split('/');
		var target_type = task.target_type;
		if(!target_type){
			target_type = 'all';
		}
		var sender = this.context.win.webContents;
		if(resume_breakpoint){
			file_list_db.query_mult_params({'task_id': task_id, 'isdir':1, 'app_id': app_id, 'pin': 1}, (items)=>{
				if(items && items.length>0){
					var file_item = items[0];
					self.context.log('to_continue_fetch dir path:', file_item.path);
					task.hide_resume = true;
					self.fetch_root_item(task, file_item.root_id, (root_item)=>{
						sender.send('asynchronous-spider', {'tag':'fetched_sub_file_list_continue', 'parent_dir': parent_dir, 'fid_list':[file_item.id], 'target_dir': target_dir, 'task':task, 'target_type':target_type, 'root_item':root_item});
					});
				}else{
					self._check_sub_file(app_id, task_id, parent_dir, target_dir, [], task, target_type);
				}
			})
		} else {//不显示续传button, 只能重新选择分享目录重新执行批量扫描
			
			// var sql="select DISTINCT a.parent from file_list a where a.task_id="+task.id+" and isdir=1 and not exists(select b.id from file_list b where a.parent=b.id)";
			// file_list_db.query_by_raw_sql(sql, (rows)=>{
			// 	if(rows && rows.length>0){
			// 		console.log('origin file list rows:', rows);
					
			// 	} else {
			// 		//不显示续传button, 只能重新选择分享目录重新执行批量扫描
			// 	}
			// });
		}
	},
	retry_scan:function(task){
		var self = this;
		self.continue_scan_file_list(task, (resume_breakpoint, task)=>{
			task.resume_breakpoint=resume_breakpoint;
			if(resume_breakpoint){
				self._to_continue_fetch(resume_breakpoint, task);
			} else {
				self.check_ready((tasks)=>{
					self.context._dialog(tasks);
				});
			}
		});
	},
	_check_sub_file:function(app_id, task_id, parent_dir, target_dir, last_fid_list, _task, params, target_type){
		var self = this;
		var sender = this.context.win.webContents;
		var fid_list = last_fid_list;
		file_list_db.query_mult_params({'task_id': task_id, 'isdir':1, 'app_id': app_id, 'pin': 0}, (items)=>{
			if(items && items.length>0){
				var file_item = items[0];
				self.context.log('dir path:', file_item.path);
				file_list_db.update_by_id(file_item.id, {'pin': 1},()=>{
					self.fetch_root_item(_task, file_item.root_id, (root_item)=>{
						sender.send('asynchronous-spider', {'tag':'fetched_sub_file_list_continue', 'parent_dir': parent_dir, 'fid_list':[file_item.id], 'target_dir': target_dir, 'task':_task, 'target_type':target_type, 'root_item':root_item});
					});
				});
			} else {
				file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'isdir':0},(cnt_row)=>{
					var total_cnt = 0;
					if(cnt_row){
						total_cnt = cnt_row.cnt;	
					}
					file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'isdir':1},(dir_cnt_row)=>{
						var dir_cnt = 0;
						if(dir_cnt_row){
							dir_cnt = dir_cnt_row.cnt;
						}
						_task.num = total_cnt;
						_task.dirnum = dir_cnt;
						transfer_tasks_db.update_by_id(task_id, {'pin': 1, 'num':_task.num, 'dirnum':_task.dirnum}, ()=>{
							_task.pin = 1;
							self.context.update_statistic(_task);
							sender.send('asynchronous-spider',{'tag':'fetch_file_list_complete', 'params':params,
								'fid_list': fid_list, 'parent_dir': parent_dir, 'target_dir': target_dir, 'target_type':target_type
							});
							self.check_ready((tasks)=>{
								self.context._dialog(tasks);
							});
						});
					});
				});
			}
		}, 1);
	},
	on_fetched:function(args){
		var self = this;
		var sender = this.context.win.webContents;
		var params = args.params, fid_list = args.fid_list, parent_dir = args.parent_dir, target_dir = args.target_dir, pos = args.pos, 
		result=args.result, app_id = args.app_id, file_items = args.hasOwnProperty('file_items')?args.file_items:null, root_item = args.root_item;
		var target_type = 'all';
		var only_fetch_dir = false;
		if(args.hasOwnProperty('target_type')){
			target_type = args.target_type;
			if('dir' == target_type){
				only_fetch_dir = true;
			}
		}
		var task_name = "";
		if(args.hasOwnProperty('task_name')){
			task_name = args.task_name;
		}
		var has_records = result?result.hasOwnProperty('records'):false;
		var parent_fid = fid_list[pos];
		
		this.check_out_task(params, parent_dir, target_dir, app_id, (item)=>{
			var _task = item;
			if(result.errno!=0){
				self.context.log('on_fetched error result:', result);
			}
			if(result.errno == 0 || result.errno == -9){
				if(has_records){
					self.context.check_open_popwin((popwin)=>{
						if(!popwin){
							self.check_ready((tasks)=>{
								self.context._dialog(tasks,()=>{},false, false);
							});
						}
					});
					var records = result.records;
					_task.num = _task.num + records.length;
					file_list_db.save_list_one_by_one(records, 
					(new_item, _get_item, cb)=>{
						//conflict
						_task.num = _task.num - 1;
						if(item.id != _get_item.task_id){
							if(cb){
								cb(new_item);
							}
							return true;//update it.
						}
						if(cb){
							if(new_item.isdir == 1){
								cb({'pin':0});
							} else {
								cb(null);//not update it.
							}
						}
						return false;
					}, 
					(r)=>{
						if(only_fetch_dir && r.isdir == 0){
							_task.num = _task.num - 1;
							if(!result.hasOwnProperty('origin_has_more')){
								result.origin_has_more = result.has_more;
							}
							result.has_more = 0;
							return null;
						} else {
							
							return {
								'id':r.fs_id,
								'parent':parent_fid,
								'category':r.category,
								'isdir':r.isdir,
								'filename':r.server_filename,
								'path':r.path,
								'server_ctime':r.server_ctime,
								'server_mtime':r.server_mtime,
								'root_id':root_item.fid,
								'tm':Date.now(),
								'size':r.size,
								'pin':0,
								'app_id':app_id,
								'task_id':item.id
							};
						}
					}, (_list)=>{
						self.context.update_statistic(_task);
						next_oper();
					});
				} else {
					next_oper();
				}
				function next_oper(){
					if(result.has_more == 1){
						params.page += 1;
						sender.send('asynchronous-spider',{'tag':'fetch_file_list_continue', 'params':params,
							'fid_list': fid_list, 'parent_dir': parent_dir, 'pos': pos, 'task':_task, 'target_type':target_type, 
							'root_item':root_item
						})
					} else {
						pos = pos + 1;
						params.page = 1;
						if(pos < fid_list.length){
							var target_fid = fid_list[pos];
							var _root_item = _task.file_items.hasOwnProperty(target_fid)?_task.file_items[target_fid]:{}
							sender.send('asynchronous-spider',{'tag':'fetch_file_list_continue', 'params':params,
								'fid_list': fid_list, 'parent_dir': parent_dir, 'pos': pos, 'task':_task, 'target_type':target_type,
								'root_item':_root_item
							})
						} else {
							var re_call_update_file_pin=(pos)=>{
								if(pos<fid_list.length){
									var file_id = fid_list[pos];
									// console.log('update file_id pin = 3:', file_id);
									file_list_db.update_by_id(file_id, {'pin': 3}, ()=>{
										re_call_update_file_pin(pos+1);
									});
								} else {
									setTimeout(()=>{
										// check_sub_file(item.id);
										self._check_sub_file(app_id, _task.id, parent_dir, target_dir, fid_list, _task, params, target_type);
									}, 200);
									return;
								}
							};
							re_call_update_file_pin(0);
							
						}
					}
				}
			}
		}, has_records, task_name, target_type, file_items);
	}
});

module.exports = fetch_file_list_helper;