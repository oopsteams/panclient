const {BrowserWindow, ipcMain, session} = require('electron');
const request = require('request');
const urlib = require('url')
const helpers = require("./helper.core.js")
const Base = require("./base.js")
const show_alert = require("./show_alert.js")
const fetch_file_list_helper = require("./fetchfilelist.js")
var path = require('path');
const async = require('async');
// const os = require('os');
// var base_dir = os.homedir();
var base_dir = __dirname;

const url_mapping = {
	// 'mbox/homepage':enter_social_group,
	'mbox/homepage':inject_btn_group,
	'disk/home':empty,
}
const manual_url_mapping = {
	'mbox/homepage':enter_social_group,
	'disk/home':disk_home
}
var fetched_global_base_params = {};
function find_func(loc, _mapping){
	if(!_mapping){
		_mapping = url_mapping;
	}
	for(var key in _mapping){
		if(loc.indexOf(key)>=0){
			return _mapping[key];
		}
	}
	return null;
}
function disk_home(params, task){
	var gparams = params;
	console.log('find_share_btn......');
	this.win.webContents.send('asynchronous-spider', {tag:'find_share_btn','task':task, 'gparams':gparams});
}
function enter_social_group(params, task){
	// var tasks = params.tasks;
	var gparams = params;
	var gid = task.gid;
	var gname = '';
	var gphoto_href = null;
	if(gparams.hasOwnProperty('group_list')){
		var group_list = gparams.group_list;
		if(group_list.records){
			var records = group_list.records;
			for(var i=0;i<records.length;i++){
				var r = records[i];
				if(r.gid == gid){
					gname = r.name;
					gphoto_href = r.photoinfo&&r.photoinfo.length>0?r.photoinfo[0].photo:null;
					break;
				}
			}
		}
	}
	this.win.webContents.send('asynchronous-spider', {tag:'find_group_btn', 
	options:{'root':{'tag':'ul.session-list', 'attrs':{'node-type':'session-list'}},'parent':{'tag':'li.session-list-item', 'attrs':{'node-type':'session-list-item'}, 'child':{'tag':'p.user-name', 'attrs':{'title':gname}}},
	'attrs':{'node-type':'session-list-avatar'},
	'tag':'a'},'task':task, 'gparams':gparams
	});
}
function inject_btn_group(){
	this.win.webContents.send('asynchronous-spider', {tag:'inject_btn_group', 
	options:{'root':{'tag':'div.sharelist-shareViews', 'attrs':{'node-type':'shareViews'}},'parent':{'tag':'div.sharelist-view-toggle'},
	'attrs':{'node-type':'btn_filter'},
	'tag':'a.list-filter'}
	});
}
function enter_shared_dir(){
	this.win.webContents.send('asynchronous-spider', {tag:'find_shared_dir', 
	options:{'root':{'tag':'div.all-content', 'attrs':{'node-type':'all-content'}},'parent':{'tag':'div.title[data-msgid]', 'attrs':{'title':'02.会员库【已完结课程】'}},
	'attrs':{'node-type':'file-name'},
	'tag':'a.file-name'}
	});
}
const filter = {
  urls: ['https://*.baidu.com/*']
}
var fetched_base_params_ok = false;
function interceptHttp(){
	var self = this;
	session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
	  // callback({cancel: false, requestHeaders: details.requestHeaders})
	  if(details.url){
		  var key = '/list?';
		  var idx = details.url.indexOf(key);
		  if(idx>0){
				uri_obj = urlib.parse(details.url, true);
				if(uri_obj){
					// console.log("base params:", uri_obj.query);
					helpers.extend(fetched_global_base_params, uri_obj.query);
					if(!fetched_base_params_ok){
						if(fetched_global_base_params.hasOwnProperty('app_id')){
							self.fetch_helper.update_options('app_id', fetched_global_base_params.app_id);
						}
						self.fetch_helper.check_ready((tasks)=>{
							self.win.webContents.send('asynchronous-spider',{'tag':'fetch_base_params', 'params':uri_obj.query, 'tasks':tasks});
						});
					}
					fetched_base_params_ok = true;
				}
		  }
		  key = '/shareinfo?';
		  idx = details.url.indexOf(key);
		  if(idx>0){
				uri_obj = urlib.parse(details.url, true);
				if(uri_obj){
					// console.log("share params:", uri_obj.query);
					fetched_global_base_params['share_params'] = uri_obj.query;
					self.win.webContents.send('asynchronous-spider',{'tag':'fetch_shared_params', 'params':uri_obj.query})
				}
		  }
	  }
	  callback(details);
	})
	this.win.webContents.send('asynchronous-spider',{'tag':'intercepted', 'st':0})
}
function unInterceptHttp(){
	
}
function empty(){
	console.log(this.first_show);
}
function fetched_file_list_action(args){
	this.fetch_helper.on_fetched(args)
}
var window_helper = Base.extend({
	constructor:function(account, parent_win, options){
		this.account = account;
		this.options = options;
		this.parent_win = parent_win;
		this.win = null;
		this.first_show = false;
		this.fetch_helper = null;
		this.popwin = null;
		this.alertwin = null;
		this.popwin_params = {};
		this.wait_mbox_homepage_call_manual_fun = null;
		this.last_web_uid = {};
	},
	update_statistic(task){
		var self = this;
		if(self.popwin){
			self.popwin.webContents.send('asynchronous-popwin', {'tag':'statistic', 'task':task, 'gparams':fetched_global_base_params});
		}
	},
	_dialog:function(tasks,cb,ismodal,bancloseable){
		var params = {'tasks':tasks, 'gparams':fetched_global_base_params};
		this.dialog(params,cb,ismodal,bancloseable);
	},
	popwin_send:function(args){
		var self = this;
		if(self.popwin){
			self.popwin.webContents.send('asynchronous-popwin', args);
			return true;
		}
		return false;
	},
	check_open_popwin:function(callback){
		var self = this;
		if(self.popwin){
			callback(self.popwin);
		} else {
			callback(null)
		}
	},
	force_close_popwin:function(){
		var self = this;
		if(self.popwin){
			self.popwin.close();
		}
	},
	dialog:function(params,callback,ismodal,bancloseable){
		var self = this;
		self.popwin_params = params;
		if(!self.popwin){
			var options = {
						modal:ismodal?true:false,
						parent:self.win,
						width:800,
						height:400,
						resizable:false,
						show:false,
						title:'转移文件',
						closable:bancloseable?false:true,
						webPreferences: {
						  nodeIntegration: true,
						  webSecurity: false,
						  allowRunningInsecureContent: true,
						  preload: path.join(__dirname, 'spider_task.js')
						}
					};
			self.popwin = new BrowserWindow(options);
			self.popwin.once('ready-to-show', () => {
				self.popwin.show();
			});
			self.popwin.on('closed', () => {
			  self.popwin = null;
			})
			self.popwin.webContents.on('did-finish-load', () => {
				console.log('send start=====>');
			    self.popwin.webContents.send('asynchronous-popwin', {tag:'start'});
			  });
			// console.log('dialog params:', self.popwin_params);
			ipcMain.on('asynchronous-popwin-backend', (event, args) => {
				if('ready' == args.tag){
					args.tag = 'ready_ok';
					args.params = self.popwin_params;
					console.log('recv  ready  !!!');
					self.popwin.webContents.send('asynchronous-popwin', args);
				} else if('init_ok' == args.tag){
					// console.log('recv  init  !!!');
					if(callback){
						callback(self);
					}
				} else if('start_transfer' == args.tag){
					var quota = args.quota;
					var task = args.task;
					console.log('start_transfer task:', task);
					self.fetch_helper.transfer(task);
				} else if('retry_transfer' == args.tag){
					var quota = args.quota;
					var task = args.task;
					console.log('retry_transfer task:', task);
					self.fetch_helper.transfer(task, true);
					
				} else if('delete_task' == args.tag){
					self.fetch_helper.del(args.task);
				} else if('retry_scan' == args.tag){
					self.fetch_helper.retry_scan(args.task);
				}
			});
		}else{
			self.popwin.setClosable(bancloseable?false:true)
		}
		self.popwin.loadURL(`file://${__dirname}/transfer_tasks.html`);
		
	},
	open:function(){
		var self = this;
		var w = this.options['width']?this.options['width']:700;
		var h = this.options['height']?this.options['height']:600;
		if(!self.win){
			this.win = new BrowserWindow({
			  width: w,
			  height: h,
			  parent: self.parent_win,
			  modal: false,
			  resizable:false,
			  show:false,
			  closable:true,
			  webPreferences: {
			    nodeIntegration: true,
			    webSecurity: false,
			    allowRunningInsecureContent: true,
				preload: path.join(__dirname, 'spider.js')
			  }
			});
			this.fetch_helper = new fetch_file_list_helper(this, {'account': this.account});
		}
		this.win.once('ready-to-show', () => {
			this.first_show = true;
			self.win.show();
		});
		this.win.on('closed', () => {
		  self.win = null;
		});
		this.win.on('show', (event) => {
		  console.log('win handler show! event:', event);
		  // self.win.webContents.executeJavaScript('__spider()').then((result)=>{
		  // 	console.log('did-finish-load result:', result);
		  // });
		});
		
		self.win.webContents.on('did-finish-load', () => {
			console.log('will send spider start!');
		    self.win.webContents.send('asynchronous-spider', {tag:'start', 'params': fetched_global_base_params, 'base_dir':base_dir});
		  });
		
		ipcMain.on('asynchronous-spider-backend', (event, args) => {
			// console.log('ipcMain backend recv event:%s, args:%s', event, args);
			if('check_loc'==args.tag){
				var loc = args.loc;
				var uid = args.uid;
				console.log('loc:', loc);
				var simple_loc = loc;
				var idx = loc.indexOf('#');
				if(idx>0){
					simple_loc = loc.substring(0, idx);
				}
				idx = simple_loc.indexOf('?');
				if(idx>0){
					simple_loc = loc.substring(0, idx);
				}
				if(this.last_web_uid[simple_loc] != uid){
					this.last_web_uid[simple_loc] = uid;
				} else {
					return;
				}
				var func = find_func(loc);
				if(self.wait_mbox_homepage_call_manual_fun&&loc.indexOf('mbox/homepage')>=0){
					console.log('wait_mbox_homepage_call_manual_fun:', loc);
					var man_func = find_func(loc, manual_url_mapping);
					man_func.apply(self, self.wait_mbox_homepage_call_manual_fun);
					self.wait_mbox_homepage_call_manual_fun = null;
				}
				if(func){
					func.apply(self)
				}
			} else if("found" == args.tag){
				args.tag = 'click';
				self.win.webContents.send('asynchronous-spider', args);
			} else if("intercept" == args.tag){
				interceptHttp.apply(self);
			} else if('close-intercept' == args.tag){
				unInterceptHttp.apply(self);
			} else if('fetched_base_params' == args.tag){
				helpers.extend(fetched_global_base_params, args.params);
				// console.log('fetched_global_base_params:', fetched_global_base_params);
			} else if('fetched_file_list' == args.tag){
				fetched_file_list_action.apply(self, [args]);
			} else if('fetched_bd_context' == args.tag){
				self.win.webContents.executeJavaScript('window.__bd_ctx=require("common:widget/context/context.js");').then((result)=>{
					args.tag='fetched_bd_context_ready';
					args['global_params'] = fetched_global_base_params;
					self.win.webContents.send('asynchronous-spider', args);
				});
			} else if('check_self_dir_end' == args.tag){
				var rs = args.rs;
				self.fetch_helper.on_check_dir(args, ()=>{
					console.log('check dir end ok!');
				});
			} else if('to_check_file_dir' == args.tag){
				self.fetch_helper.check_dir_exist(args);
			} else if('to_start_transfer' == args.tag){//Test
				var app_id = args.app_id;
			} else if('dialog' == args.tag){
				var loc = args.loc;
				var func = find_func(loc, manual_url_mapping);
				var tasks = args.params.tasks;
				var gparams = args.params.gparams;
				for(var j=0;j<tasks.length;j++){
					var _t = tasks[j];
					if([5, 9].indexOf(_t.pin)<0){
						// goto file list
						self.alertwin = show_alert.show("正在初始化!", self.win, (state)=>{
							if('closed' == state){
								setTimeout(()=>{
									self.dialog(args.params);
								},1);
							}else if('ready' == state){
								self.wait_mbox_homepage_call_manual_fun = [gparams, _t];
								func.apply(self, [gparams, _t]);
							}
						},{'modal':true, 'width':360, 'height':200})
						
						return;
						
					}
				}
				console.log('直接弹 转移任务 管理窗口');
				self.dialog(args.params);
			} else if('find_share_btn_ok' == args.tag){
				var loc = args.loc;
				// var func = find_func(loc, manual_url_mapping);
				var task = args.task;
				var gparams = args.gparams;
				console.log('ready to check next elem:', loc);
				if(loc.indexOf('mbox/homepage')>=0){
					var func = find_func(loc, manual_url_mapping);
					func.apply(self, [gparams, task]);
				} else {
					// self.wait_mbox_homepage_call_manual_fun = [gparams, task];
				}
				// func.apply(self, [gparams, task]);
			}else if('transfer_ok_continue' == args.tag){
				if(args.hasOwnProperty('skip')){
					var skip = args.skip;
					if(skip){
						console.log('transfer_ok_continue:', args);
					}
				}
				self.fetch_helper.on_transfer_continue(args);
			} else if('transfer_ok_continue_failed' == args.tag){
				//TODO 
				self.fetch_helper.on_transfer_continue(args, true);
			} else if('init_page_ok' == args.tag){
				if(self.alertwin){
					self.alertwin.setClosable(true);
					self.alertwin.close();
					self.alertwin = null;
				}
				// var gparams = args.gparams;
				// self.fetch_helper.check_ready((tasks)=>{
				// 	self.dialog({'tasks':tasks, 'gparams':gparams});
				// });
			} else if('scan_file_list_failed' == args.tag){
				if(self.alertwin){
					var script_val = 'document.write(\'<h1>'+args.msg+'</h1>\');';
					self.alertwin.webContents.executeJavaScript(script_val).then((result)=>{
						console.log('alert_window execute result:', result);
					});
					self.alertwin.setClosable(true);
				} else {
					show_alert.show(args.msg, self.win, (state)=>{
						if('closed' == state){
							setTimeout(()=>{
								self.dialog(args.params);
							},1);
						}else if('ready' == state){
							func.apply(self, [gparams, _t]);
						}
					},{'closable':true, 'modal':false, 'width':360, 'height':200})
				}
			} else if('test_recursive' == args.tag){
				var task_id=args.task_id, folder_id=args.folder_id;
				self.fetch_helper.test_recursive(task_id, folder_id);
			}
		});
		if(this.first_show){
			self.win.show();
		}
		// this.win.webContents.openDevTools();
		interceptHttp.apply(this);
		this.win.loadURL(this.options['url']);
	}
});

module.exports = window_helper;
