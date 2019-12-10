const {BrowserWindow, ipcMain, session} = require('electron');
const request = require('request');
const helpers = require("./helper.core.js")
const Base = require("./base.js")
const Dao = require('./dao.js')
const transfer_bulk_size = 999;
var file_list_db = new Dao({'type':'list', 'name':'file_list', 
'fields':[{name:"id", type:'VARCHAR', len:20},
		{name:"category", type:'INT'},
		{name:"parent", type:'VARCHAR', len:20},
		{name:"isdir", type:'INT'},
		{name:"filename", type:'VARCHAR', len:512},
		{name:"path", type:'VARCHAR', len:1024},
		{name:"size", type:'INT'},
		{name:"pin", type:'INT'},
		{name:"server_ctime", type:'INT'},
		{name:"server_mtime", type:'INT'},
		{name:"tm", type:'INT'},
		{name:"app_id", type:'INT'},
		{name:"task_id", type:'INT'},
	]
});
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
		{name:"app_id", type:'INT'}
	]
});
var transfer_dirs_db = new Dao({'type':'list', 'name':'transfer_dirs', 
'fields':[{name:"id", type:'VARCHAR', len:512},
		{name:"fs_id", type:'VARCHAR', len:20},
		{name:"pin", type:'INT'},
		{name:"app_id", type:'INT'}
	]
});


var fetch_file_list_helper = Base.extend({
	constructor:function(context, options){
		this.context = context;
		this.options = options;
		this.cache = {};
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
				console.log('file:', file);
				file_list_db.update_by_id(file.id, {'pin': 4}, function(){
					setTimeout(()=>{
						sender.send('asynchronous-spider', {'tag':'start_transfer', 'parent_item': {'id':file.parent}, 'file':file, 'task': task});
					}, 100);
					
				});
			} else {
				file_list_db.query_count({'task_id': task_id, 'isdir':0, 'app_id': app_id, 'pin': 5},(cnt_row)=>{
					if(cnt_row){
						var total_cnt = cnt_row.cnt;
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
										'err':'存在转存失败文件,请尝试重新转存按钮!'
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
				console.log('pos >= length:',pos, sub_folders.length);
				callback(true, main_folder_file);
				return;
			}
			console.log('main_folder_file.total > transfer_bulk_size',main_folder_file.total,transfer_bulk_size);
			if(main_folder_file.total > transfer_bulk_size){
				//callback can not bulk
				console.log('main_folder_file.total > transfer_bulk_size');
				callback(false, main_folder_file);
			} else {
				var __folder_file = sub_folders[pos];
				file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'parent':__folder_file.id},(cnt_row)=>{
					
					var total_cnt = cnt_row.cnt;
					if(total_cnt>transfer_bulk_size || total_cnt == 0){
						//callback can not bulk
						console.log('total_cnt > transfer_bulk_size');
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
										console.log('file_folder_cnt == total_cnt,have folder pin not equal 0');
										callback(false, main_folder_file);
									} else if(file_folder_cnt+file_cnt == total_cnt){
										//recursive count
										query_sub_folders(__folder_file.id, task_id, app_id, (_sub_folders)=>{
											
											update_size_count(__folder_file.id, task_id, app_id,(sub_size)=>{
												main_folder_file.total += file_cnt;
												main_folder_file.size += sub_size;
												// console.log('recursive to fetch sub folder:', _sub_folders);
												get_count(main_folder_file, _sub_folders, 0, (come_on, _main_folder_file)=>{
													if(come_on){
														_sub_folders.forEach((sf, index)=>{main_folder_file.sub_folders.push(sf)});
														get_count(main_folder_file, sub_folders, pos+1, callback);
													} else {
														callback(false, main_folder_file);
													}
												});
											});
										});
										
									} else {//part file&folder pin not equal 0
										//callback can not bulk
										console.log('file_folder_cnt != total_cnt');
										callback(false, main_folder_file);
									}
								});
							} else {
								// total_cnt size
								console.log('total_cnt == file_cnt, will update_size_count:',file_cnt, total_cnt);
								update_size_count(__folder_file.id, task_id, app_id,(sub_size)=>{
									main_folder_file.total += file_cnt;
									main_folder_file.size += sub_size;
									// get_count=(main_folder_file, sub_folders, pos+1, callback);
									
									get_count(main_folder_file, sub_folders, pos+1, callback);
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
				file_list_db.update_by_id(folder.id, {'pin': 4, 'tm':helpers.now()}, function(){
					folder.pin = 4;
					file_list_db.update_by_conditions({'parent':folder.id, 'task_id':task_id, 'isdir':0}, {'pin': 2}, function(){
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
			self.recursive_count_folder_file(task, parent_item, (may_bulk, main_folder)=>{
				if(may_bulk){
					recursive_update_folder_sub_file(0, main_folder.sub_folders.concat([main_folder]),()=>{
						setTimeout(()=>{
							sender.send('asynchronous-spider', {'tag':'start_transfer', 'parent_item': parent_item, 'file':parent_item, 'task': task});
						}, 100);
					});
				} else {
					one_by_one();
				}
				// console.log('main_folder:',main_folder);
				
			});
		}
		
		function check_bulk_conditions(){
			file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'parent':parent_item.id},(cnt_row)=>{
				if(cnt_row){
					var total_cnt = cnt_row.cnt;
					file_list_db.query_count({'app_id': app_id, 'task_id':task_id, 'parent':parent_item.id, 'isdir':0, 'pin':0},(fcnt_row)=>{
						if(fcnt_row){
							var file_cnt = fcnt_row.cnt;
							if(!need_one_by_one && file_cnt < transfer_bulk_size && file_cnt == total_cnt){
								parent_item['total'] = file_cnt;
								file_list_db.query_sum('size', {'parent':parent_item.id, 'task_id':task_id}, (sum_row)=>{
									if(sum_row){
										parent_item.size = sum_row.val;
									}
									file_list_db.update_by_conditions({'parent':parent_item.id, 'task_id':task_id}, {'pin': 2}, function(){
										setTimeout(()=>{
											sender.send('asynchronous-spider', {'tag':'start_transfer', 'parent_item': parent_item, 'file':parent_item, 'task': task});
										}, 100);
									});
								});
							} else {
								console.log('need_one_by_one:',need_one_by_one,',file_cnt:',file_cnt,',folder total_cnt:',total_cnt);
								one_by_one();
							}
						} else {
							next_step();
						}
					});
				} else {
					next_step();
				}
			});
		}
		
		function one_by_one(){
			file_list_db.query_mult_params({'parent': parent_item.id, 'task_id':task_id, 'isdir':0, 'app_id': app_id, 'pin': 0}, (file_list)=>{
				if(file_list && file_list.length>0){
					var file = file_list[0];
					console.log('fetch_sub_file_list file:', file.path);
					file_list_db.update_by_id(file.id, {'pin': 4}, function(){
						setTimeout(()=>{
							sender.send('asynchronous-spider', {'tag':'start_transfer', 'parent_item': parent_item, 'file':file, 'task': task});
						}, 100);
						
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
					file_list_db.update_by_conditions({'parent':folder.id, 'task_id':task_id, 'isdir':0}, {'pin': 5}, function(){
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
				console.log('dir tranfer failed!:', file.path);
				// file_list_db.update_by_id(file.id, {'pin': 6}, function(){
				// 	self.transfer(task);
				// });
				self.transfer(task);
				return;
			} else {
				console.log('recursive_update_folder_sub_file sub_folders:', file.sub_folders.length);
				recursive_update_folder_sub_file(0, file.sub_folders.concat([file]),()=>{
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
				// file_list_db.update_by_conditions({'parent':file.id,'task_id':task.id}, {'pin': 5}, function(){
				// 	file_list_db.update_by_id(file.id, {'pin': 5}, function(){
				// 		// console.log('dir tranfer ok!:', file.path);
				// 		if(file.hasOwnProperty('total')){
				// 			var cnt = file['total'];
				// 			if(task.hasOwnProperty('over_count')){
				// 				task['over_count'] = task['over_count'] + cnt;
				// 				self.context.popwin_send({'tag':'progress',
				// 					'id': task.id,
				// 					'over': task['over_count'] == task['total_count'],
				// 					'task': task
				// 				});
				// 			}
				// 		}
				// 		self.transfer(task);
				// 	});
				// });
			}
		} else {
			if(failed){
				console.log('file tranfer failed!:', file.path);
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
	transfer:function(task,retry){
		var self = this;
		var task_id = task.id;
		var app_id = task.app_id;
		
		if(retry){
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
			}, 1);
		};
	},
	del:function(task){
		var self = this;
		file_list_db.del('task_id', task.id, ()=>{
			transfer_tasks_db.update_by_id(task.id,{'pin':9}, ()=>{
				self.check_ready((tasks)=>{
					self.context._dialog(tasks);
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
		function to_check_task_file_cnt(_t, cb){
			var app_id = _t.app_id;
			q_cnt(app_id, _t.id, (o_cnt, t_cnt, total_size)=>{
				_t['over_count'] = o_cnt;
				_t['total_count'] = t_cnt;
				_t['total_size'] = total_size;
				if(_t.num != _t.total_count){
					_t.num = _t.total_count;
					transfer_tasks_db.update_by_id(_t.id,{'num': _t.num},()=>{
						cb();
					});
				} else {
					cb();
				}
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
				console.log("to check task:", task.id, task.path, task.target_path, task.over_count, task.total_count);
				var idx = dir.indexOf(path);
				if(idx>=0){
					var target_suffix_dir = dir.substring(idx+path.length);
					console.log('target_suffix_dir:', target_suffix_dir);
					var target_dir = target_path + target_suffix_dir;
					console.log('target_dir:', target_dir);
					var sender = self.context.win.webContents;
					transfer_dirs_db.query_start_with_params({'id': target_dir, 'app_id':app_id}, (items)=>{
						if(items && items.length>0){
							// console.log('find the dir:', items);
							args.tag = 'to_transfer_confirm';
							args.target_dir = target_dir;
							sender.send('asynchronous-spider',args);
						} else {
							console.log('can not find the dir:', dir);
							if(need_one_by_one){
								sender.send('asynchronous-spider',{'tag':'check_self_dir', 'dir':target_dir, "task":task, "file": file, "parent_item": parent_item});
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
	check_out_task:function(params, parent_dir, target_dir, app_id, cb, has_records, task_name){
		var self = this;
		var path = parent_dir.join('/');
		var key = ''+app_id+'_'+path+'_'+task_name+'_'+target_dir;
		var msgid = params.msgid;
		var fromuk = params.fromuk;
		var _gid = params._gid;
		var stype = params.ftype;
		if(this.cache.hasOwnProperty(key) && this.cache[key]){
			cb(this.cache[key]);
		} else {
			transfer_tasks_db.query_mult_params({'path': path, 'app_id': app_id, 'name':task_name, 'target_dir': target_dir}, (items)=>{
				if(items && items.length>0){
					var __item = items[0];
					self.cache[key] = __item;
					if(has_records){
						console.log('to update task:', __item);
						__item.pin = 0;
						transfer_tasks_db.update_by_id(__item.id, {'pin': 0}, ()=>{
							cb(__item);
						});
					} else {
						cb(__item);
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
						'app_id':app_id
					}
					transfer_tasks_db.put(item, (_item)=>{
						self.cache[key] = _item;
						cb(_item);
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
		var sender = this.context.win.webContents;
		if(resume_breakpoint){
			file_list_db.query_mult_params({'task_id': task_id, 'isdir':1, 'app_id': app_id, 'pin': 1}, (items)=>{
				if(items && items.length>0){
					var file_item = items[0];
					console.log('to_continue_fetch dir path:', file_item.path);
					task.hide_resume = true;
					sender.send('asynchronous-spider', {'tag':'fetched_sub_file_list_continue', 'parent_dir': parent_dir, 'fid_list':[file_item.id], 'target_dir': target_dir, 'task':task});
				}else{
					self._check_sub_file(app_id, task_id, parent_dir, target_dir, [], task);
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
	_check_sub_file:function(app_id, task_id, parent_dir, target_dir, last_fid_list, _task, params){
		var self = this;
		var sender = this.context.win.webContents;
		var fid_list = last_fid_list;
		file_list_db.query_mult_params({'task_id': task_id, 'isdir':1, 'app_id': app_id, 'pin': 0}, (items)=>{
			if(items && items.length>0){
				var file_item = items[0];
				console.log('dir path:', file_item.path);
				file_list_db.update_by_id(file_item.id, {'pin': 1},()=>{
					sender.send('asynchronous-spider', {'tag':'fetched_sub_file_list_continue', 'parent_dir': parent_dir, 'fid_list':[file_item.id], 'target_dir': target_dir, 'task':_task});
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
								'fid_list': fid_list, 'parent_dir': parent_dir, 'target_dir': target_dir
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
		result=args.result, app_id = args.app_id;
		var task_name = "";
		if(args.hasOwnProperty('task_name')){
			task_name = args.task_name;
		}
		var has_records = result?result.hasOwnProperty('records'):false;
		var parent_fid = fid_list[pos];
		
		this.check_out_task(params, parent_dir, target_dir, app_id, (item)=>{
			var _task = item;
			if(result.errno!=0){
				console.log('on_fetched error result:', result);
			}
			if(result.errno == 0 || result.errno == -9){
				if(has_records){
					self.context.check_open_popwin((popwin)=>{
						if(!popwin){
							self.check_ready((tasks)=>{
								self.context._dialog(tasks,()=>{},true, true);
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
						return {
							'id':r.fs_id,
							'parent':parent_fid,
							'category':r.category,
							'isdir':r.isdir,
							'filename':r.server_filename,
							'path':r.path,
							'server_ctime':r.server_ctime,
							'server_mtime':r.server_mtime,
							'tm':Date.now(),
							'size':r.size,
							'pin':0,
							'app_id':app_id,
							'task_id':item.id
						};
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
							'fid_list': fid_list, 'parent_dir': parent_dir, 'pos': pos, 'task':_task
						})
					} else {
						pos = pos + 1;
						params.page = 1;
						if(pos < fid_list.length){
							sender.send('asynchronous-spider',{'tag':'fetch_file_list_continue', 'params':params,
								'fid_list': fid_list, 'parent_dir': parent_dir, 'pos': pos, 'task':_task
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
										self._check_sub_file(app_id, _task.id, parent_dir, target_dir, fid_list, _task, params);
									}, 200);
									return;
								}
							};
							re_call_update_file_pin(0);
							// var check_sub_file = (task_id)=>{
							// 	file_list_db.query_mult_params({'task_id': task_id, 'isdir':1, 'app_id': app_id, 'pin': 0}, (items)=>{
							// 		if(items && items.length>0){
							// 			var file_item = items[0];
							// 			console.log('dir path:', file_item.path);
							// 			file_list_db.update_by_id(file_item.id, {'pin': 1},()=>{
							// 				sender.send('asynchronous-spider', {'tag':'fetched_sub_file_list_continue', 'parent_dir': parent_dir, 'fid_list':[file_item.id], 'target_dir': target_dir});
							// 			});
							// 		} else {
							// 			var task_id = _task.id;
							// 			file_list_db.query_count({'app_id': _task.app_id, 'task_id':task_id, 'isdir':0},(cnt_row)=>{
							// 				var total_cnt = 0;
							// 				if(cnt_row){
							// 					total_cnt = cnt_row.cnt;	
							// 				}
							// 				file_list_db.query_count({'app_id': self.options.app_id, 'task_id':task_id, 'isdir':1},(dir_cnt_row)=>{
							// 					var dir_cnt = 0;
							// 					if(dir_cnt_row){
							// 						dir_cnt = dir_cnt_row.cnt;
							// 					}
							// 					_task.num = total_cnt;
							// 					_task.dirnum = dir_cnt;
							// 					transfer_tasks_db.update_by_id(_task.id, {'pin': 1, 'num':_task.num, 'dirnum':_task.dirnum}, ()=>{
							// 						_task.pin = 1;
							// 						self.context.update_statistic(_task);
													
							// 						sender.send('asynchronous-spider',{'tag':'fetch_file_list_complete', 'params':params,
							// 							'fid_list': fid_list, 'parent_dir': parent_dir, 'target_dir': target_dir, 'pos': pos
							// 						});
							// 						self.check_ready((tasks)=>{
							// 							self.context._dialog(tasks);
							// 						});
							// 					});
							// 				});
							// 			});
							// 		}
							// 	}, 1);
							// };
							
						}
					}
				}
			}
		}, has_records, task_name);
	}
});

module.exports = fetch_file_list_helper;