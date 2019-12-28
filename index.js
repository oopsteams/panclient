const { app, BrowserWindow, Menu, ipcMain, dialog, session} = require('electron');
const unhandled = require('electron-unhandled');
const logger = require('electron-log');
const cfg = require('electron-cfg');
const request = require('request');
const fs = require('fs');
const os =  require('os');
unhandled();
var path = require('path');
var base_dir = os.homedir();
const helpers = require("./helper.core.js");
const window_helper = require("./open_window.js");
// logger.transports.file.level = false;
// logger.transports.console.level = false;
var data_dir = path.join(base_dir, helpers.data_dir_name);
// var log_dir = path.join(base_dir, helpers.log_dir_name);
var dao = null;// wait data_dir make success
if(!fs.existsSync(data_dir)){
  fs.mkdirSync(data_dir);
  console.log('['+data_dir+']dir make success!');
  dao = require('./dao.js');// wait data_dir make success
}else{
  dao = require('./dao.js');// wait data_dir make success
  console.log('['+data_dir+']dir exist!');
}
// if(!fs.existsSync(log_dir)){
//   fs.mkdirSync(log_dir);
//   console.log('['+log_dir+']dir make success!');
  
// }
// logger.transports.file.file = path.join(log_dir, helpers.log_dir_name);
const Multi_loader = require('./multi.node.loader.js');
const account = require('./account.js');

let point = helpers.point;
let mainWindow;
let gSender = null;
var file_detail_cache = {}

function on_quit_app(){
	Multi_loader.stop();
	dao.close();
}

// const fileloader = new FileLoader();
// const multi_loader = new Multi_loader();
var cookie_cause={
	'explicit':'Cookie由消费者的行为直接改变。',
	'overwrite':'由于重写它的插入操作，cookie被自动删除。',
	'expired':'Cookie在过期时自动删除。',
	'evicted':'垃圾收集期间，Cookie被自动清除。',
	'expired-overwrite':'cookie已被过期的过期日期覆盖。'
};
var loader_list = {}
function ready_cookie_monitor(){
	// session.defaultSession.cookies.get({}, (err, cookies)=>{
	// 	console.log("all cookie:",cookies, err);
	// });
	// session.defaultSession.cookies.on("changed", (event, cookie, cause, removed)=>{
	// 	// console.log("事件:",event);
	// 	console.log("cookie: %s=%s, domain=%s, path=%s",cookie.name, cookie.value, cookie.domain, cookie.path);
	// 	console.log("改变原因:",cookie_cause[cause]);
	// 	console.log("是否删除:",removed);
	// });
}
var menu = null;
const createWindow = () => {
  // Create the browser window.
  mainWindow = cfg.window().create({
    width: 960,
    height: 650,
	show: false,
	title:'Panclient',
	name:'PanClient',
	backgroudColor: '#2e2c29',
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
	  devTools:true,
      allowRunningInsecureContent: true
    }
  });
 //  mainWindow = new BrowserWindow({
 //    width: 960,
 //    height: 650,
	// show: false,
	// title:'Panclient',
	// backgroudColor: '#2e2c29',
 //    webPreferences: {
 //      nodeIntegration: true,
 //      webSecurity: false,
	//   devTools:true,
 //      allowRunningInsecureContent: true
 //    }
 //  });
  ready_cookie_monitor();
  ipcMain.on('asynchronous-message', (event, arg) => {
    // console.log(arg) // prints "ping"
    //finfo
    if(arg && arg.hasOwnProperty('tag')){
		var tag = arg['tag'];
		if("file" == tag){
			account.get_valid_token((tk)=>{
				Multi_loader.query_file_info(tk, arg.id, function(res){
					if(res.hasOwnProperty('error')){
					  res['tag'] = 'error';
					}else{
					  res['tag'] = tag;
					}
					console.log('query_file_info dlink:', res['item']['dlink']);
					event.sender.send('asynchronous-reply', res);
				});
			});
		}else if("download" == tag){
			item = JSON.parse(arg.data);
			if(Multi_loader.instance_map.hasOwnProperty(item.id)){
				return;
			}
			new Multi_loader(account, item, event.sender, null, (_loader)=>{
				loader_list[item.id]=_loader;
				console.log("will call multi_loader download!");
				_loader.download();
			});
			// loader_list[item.id]=multi_loader;
			
			// multi_loader.download(item, function(res){
			// 	console.log("download res:", res);
			// 	delete loader_list[item.id];
			// }, event.sender);
			// multi_loader.download();
		}else if("redownload" == tag){
			console.log("redownload args:", arg);
			var loader = Multi_loader.instance_map[arg.id];
			// console.log("redownload loader:", loader);
			loader.download(()=>{
				return true;
			});
		}else if("quit" == tag){
			if(account){
				account.close_login_window()
			}
		}else if("ready" == tag){
			gSender = event.sender;
			account.get_valid_token((tk)=>{
				if(!tk){
				  ready()
				} else {
				  event.sender.send('asynchronous-reply', {'token': tk, 'tag': tag, 'point': point})
				}
			});
			
		}else if("loaded" == tag){
			setTimeout(correct_download_task, 1);
		}else if("sync" == tag){
			item_id = arg.id;
			if(item_id){
				sync(item_id, false);
			}
		}else if("move_file" == tag){
			var loader = Multi_loader.instance_map[arg.id];
			if(loader){
				loader.move_file();
			}
		}else if("del_task" == tag){
			var loader = Multi_loader.instance_map[arg.id];
			if(loader){
				loader.del();
				delete Multi_loader.instance_map[arg.id];
			}
		}else if("pause" == tag){
			var loader = Multi_loader.instance_map[arg.id];
			if(loader){
				loader.pause();
			}
		}else if("btn_click" == tag){
			// console.log('arg:', arg);
			if('net_disk' == arg.id){
				open_bd_pan();
			}else if('self_sync_root' == arg.id){
				sync(null, false);
			}else if('reload_index' == arg.id){
				reload_index();
			}
		}
	
    }
  });

  ipcMain.on('synchronous-message', (event, arg) => {
    if(arg && arg.hasOwnProperty('tag')){
      var tag = arg['tag'];
	  if("token" == tag){
		  account.get_valid_token((tk)=>{
			  if(!tk){
			  	ready()
			  } else {
			  			  
			  }
		  });
	  }
	}
  });
  
  // and load the index.html of the app.
  // mainWindow.loadURL(`file://${__dirname}/index.html`);
  mainWindow.loadURL(`file://${__dirname}/hello.html`);
  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
	on_quit_app();
	app.quit();
    mainWindow = null;
  });
  mainWindow.on('ready-to-show', ()=>{mainWindow.show();
	ready();
  });
 
  const template = [
  //   {
  //     label: 'Edit',
  //     submenu: [
  //       // { role: 'undo' },
  //       // { role: 'redo' },
  //       // { type: 'separator' },
  //       // { role: 'cut' },
  //       // { role: 'copy' },
  //       // { role: 'paste' },
		// { role: 'quit' }
  //     ]
  //   },
	{
	  label: '增值服务',
	  submenu: [
	    { type: 'separator' },
	    {label: '加入会员', click: ()=>{alert("请联系管理员!");}},
	    {label: '申请代理', click: ()=>{alert("代理联系方式!");}}
	  ]
	},
    {
      label: 'Help',
      submenu: [
        {
          label: '重新登录',
          click: () => {
            relogin();
          }
        },
		{ type: 'separator' },
		// {label: '同步所有', click: ()=>{sync(null, true);}, id: 'self_sync_all', role:'window'},
		// {label: '同步根', click: ()=>{sync(null, false);}, id: 'self_sync_root', role:'window'},
		// {label: '修复下载文件', click: ()=>{correct_download_task();}, id: 'self_recovery_download_file'},
		// {label: '登录云盘', click: ()=>{open_bd_pan();}, id: 'login_bd_pan', role:'window'},
		// {label: '下载列表', click: ()=>{mainWindow.webContents.executeJavaScript("command('download')").then((result)=>{});}, role:'window'},
        // { type: 'separator' },
        // { role: 'reload' },
        // { role: 'forcereload' },
        { role: 'toggledevtools' },
        // { type: 'separator' },
        // { role: 'resetzoom' },
        // { role: 'zoomin' },
        // { role: 'zoomout' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ]

  menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);
var ready = function(){
	Multi_loader.ready();
	console.log("ready in.");
	account.check_state(point,mainWindow,(valide)=>{
	if(valide){
		mainWindow.loadURL(`file://${__dirname}/index.html`);
	}else{
		mainWindow.loadURL(`file://${__dirname}/hello.html`);
	}
})};
var reload_index = function(){
	account.check_state(point,mainWindow,(valide)=>{
		if(valide){
			mainWindow.loadURL(`file://${__dirname}/index.html`);
		}else{
			mainWindow.loadURL(`file://${__dirname}/hello.html`);
		}
	});
}
function relogin(){
	account.clear_token();
	ready();
}
function correct_download_task(){
	Multi_loader.correct(account, gSender, ()=>{
		// console.log("Multi_loader.instance_map:", Multi_loader.instance_map);
		gSender.send("asynchronous-reply",{"tag":"error", "error":"sync download task ok!"})
	});
}
var bd_pan_destroy_fun = (context)=>{
	gSender.send("asynchronous-reply",{"tag":"recover_btn", "id":"net_disk"})
};

var wh = null;
function open_bd_pan(){
	if(!wh){
		var wh_options = {width:1200,height:650,'url':'https://pan.baidu.com/', 'logger':logger, 'menu':menu, 'destroyed':bd_pan_destroy_fun}
		wh = new window_helper(account, mainWindow, wh_options);
	}
	wh.open();
}
function sync(item_id, recursion){
	if(!item_id){
		item_id = '';
	}
	account.get_valid_token((tk)=>{
		headers = {"SURI-TOKEN": tk, "Content-Type": "application/x-www-form-urlencoded"};
		var options = {
			method: 'GET',
			url: point+'source/syncallnodes?id='+item_id+'&recursion='+(recursion?1:0),
			followRedirect: false,
			followOriginalHttpMethod: true,
			timeout: 120000,
			strictSSL: false,
			headers: headers
		};
		request(options, function (error, response, body) {
		        if (!error && response.statusCode == 200) {
		          // body = JSON.parse(body)
				  console.log("body:", body);
				  mainWindow.webContents.executeJavaScript("alert('"+body+"')").then((result)=>{
				  });
		        }
		      });
	});
	
}
// app.on('ready', ready);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  on_quit_app();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
 //  if (mainWindow === null) {
	// ready();
 //  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
