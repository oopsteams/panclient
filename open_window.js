const {BrowserWindow, ipcMain, session} = require('electron');
const request = require('request');
const urlib = require('url')
const helpers = require("./helper.core.js")
const Base = require("./base.js")
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
var fetched_global_base_params = {};
function find_func(loc){
	for(var key in url_mapping){
		if(loc.indexOf(key)>=0){
			return url_mapping[key];
		}
	}
	return null;
}
function disk_home(){
	this.win.webContents.send('asynchronous-spider', {tag:'find_share_btn'});
}
function enter_social_group(){
	this.win.webContents.send('asynchronous-spider', {tag:'find_group_btn', 
	options:{'root':{'tag':'ul.session-list', 'attrs':{'node-type':'session-list'}},'parent':{'tag':'li.session-list-item', 'attrs':{'node-type':'session-list-item'}, 'child':{'tag':'p.user-name', 'attrs':{'title':'启墨学院【VIP】14群'}}},
	'attrs':{'node-type':'session-list-avatar'},
	'tag':'a'},'folder_title':'02.会员库【已完结课程】'
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
		this.popwin_params = {};
	},
	update_statistic(task){
		var self = this;
		if(self.popwin){
			self.popwin.webContents.send('asynchronous-popwin', {'tag':'statistic', 'task':task, 'gparams':fetched_global_base_params});
		}
	},
	_dialog:function(tasks){
		var params = {'tasks':tasks, 'gparams':fetched_global_base_params};
		this.dialog(params);
	},
	dialog:function(params,callback){
		var self = this;
		self.popwin_params = params;
		if(!self.popwin){
			var options = {
						modal:false,
						parent:self.win,
						width:650,
						height:350,
						resizable:false,
						show:false,
						title:'转移文件',
						closable:true,
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
				}
			});
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
				console.log('loc:', loc);
				var func = find_func(loc);
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
				self.dialog(args.params);
			} else if('transfer_ok_continue' == args.tag){
				self.fetch_helper.on_transfer_continue(args);
			} else if('transfer_ok_continue_failed' == args.tag){
				//TODO 
				self.fetch_helper.on_transfer_continue(args, true);
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
