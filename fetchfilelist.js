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
	fetch_sub_file_list:function(task, parent_item){
		var self = this;
		var app_id = task.app_id;
		var task_id = task.id;
		var sender = this.context.win.webContents;
		var need_one_by_one = false;
		if(task.hasOwnProperty('one_by_one')){
			need_one_by_one = task.one_by_one;
		}
		file_list_db.update_by_id(parent_item.id, {'pin': 4, 'tm':helpers.now()}, function(){
			check_bulk_conditions();
		});
		
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
				}
			});
		}
		
	},
	on_transfer_continue:function(args, failed){
		var self = this;
		var parent_item= args.parent_item, file=args.file, task= args.task;
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
				file_list_db.update_by_conditions({'parent':file.id,'task_id':task.id}, {'pin': 5}, function(){
					file_list_db.update_by_id(file.id, {'pin': 5}, function(){
						// console.log('dir tranfer ok!:', file.path);
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
				});
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
					if(file.hasOwnProperty('total')){
						var cnt = 1;
						if(task.hasOwnProperty('over_count')){
							task['over_count'] = task['over_count'] + cnt;
							self.context.popwin_send({'tag':'progress',
								'id': task.id,
								'over': task['over_count'] == task['total_count'],
								'task': task
							});
						}
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
		
		transfer_tasks_db.query_mult_params({'app_id': this.options.app_id}, (items)=>{
			if(items){
				// callback(items);
				var re_call = (pos)=>{
					if(pos >= items.length){
						callback(items);
					} else {
						var _t = items[pos];
						q_cnt(self.options.app_id, _t.id, (o_cnt, t_cnt, total_size)=>{
							_t['over_count'] = o_cnt;
							_t['total_count'] = t_cnt;
							_t['total_size'] = total_size;
							if(_t.num != _t.total_count){
								_t.num = _t.total_count;
								transfer_tasks_db.update_by_id(_t.id,{'num': _t.num},()=>{});
							}
							re_call(pos+1);
						});
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
		var key = ''+app_id+'_'+path;
		var msgid = params.msgid;
		var fromuk = params.fromuk;
		var _gid = params._gid;
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
			if(result.errno == 0){
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
							'fid_list': fid_list, 'parent_dir': parent_dir, 'pos': pos
						})
					} else {
						pos = pos + 1;
						params.page = 1;
						if(pos < fid_list.length){
							sender.send('asynchronous-spider',{'tag':'fetch_file_list_continue', 'params':params,
								'fid_list': fid_list, 'parent_dir': parent_dir, 'pos': pos
							})
						} else {
							var re_call_update_file_pin=(pos)=>{
								if(pos<fid_list.length){
									var file_id = fid_list[pos];
									console.log('update file_id pin = 3:', file_id);
									file_list_db.update_by_id(file_id, {'pin': 3}, ()=>{
										re_call_update_file_pin(pos+1);
									});
								} else {
									setTimeout(()=>{check_sub_file(item.id);}, 200);
									return;
								}
							};
							re_call_update_file_pin(0);
							var check_sub_file = (task_id)=>{
								file_list_db.query_mult_params({'task_id': task_id, 'isdir':1, 'app_id': app_id, 'pin': 0}, (items)=>{
									if(items && items.length>0){
										var file_item = items[0];
										console.log('dir path:', file_item.path);
										file_list_db.update_by_id(file_item.id, {'pin': 1});
										sender.send('asynchronous-spider', {'tag':'fetched_sub_file_list_continue', 'parent_dir': parent_dir, 'fid_list':[file_item.id], 'target_dir': target_dir});
									} else {
										var task_id = _task.id;
										file_list_db.query_count({'app_id': _task.app_id, 'task_id':task_id, 'isdir':0},(cnt_row)=>{
											var total_cnt = 0;
											if(cnt_row){
												total_cnt = cnt_row.cnt;	
											}
											file_list_db.query_count({'app_id': self.options.app_id, 'task_id':task_id, 'isdir':1},(dir_cnt_row)=>{
												var dir_cnt = 0;
												if(dir_cnt_row){
													dir_cnt = dir_cnt_row.cnt;
												}
												_task.num = total_cnt;
												_task.dirnum = dir_cnt;
												transfer_tasks_db.update_by_id(_task.id, {'pin': 1, 'num':_task.num, 'dirnum':_task.dirnum}, ()=>{
													_task.pin = 1;
													self.context.update_statistic(_task);
													
													sender.send('asynchronous-spider',{'tag':'fetch_file_list_complete', 'params':params,
														'fid_list': fid_list, 'parent_dir': parent_dir, 'target_dir': target_dir, 'pos': pos
													});
													self.check_ready((tasks)=>{
														self.context._dialog(tasks);
													});
												});
											});
										});
									}
								}, 1);
							};
							
						}
					}
				}
			}
		}, has_records, task_name);
	}
});

module.exports = fetch_file_list_helper;