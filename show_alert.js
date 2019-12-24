const {BrowserWindow} = require('electron')
const cfg = require('electron-cfg');
var path = require('path');
var alert_window = null;
function update_win_options(options){
	var winCfg_options = cfg.window().options();
	if(winCfg_options.hasOwnProperty('x')){
		options['x'] = winCfg_options['x'];
		options['y'] = winCfg_options['y'];
	}
}
var createAlertWindow =(message, parent_win, callback, params) => {
	var closable = true;
	var ismodal = true;
	var w=400,h=400;
	
	if(params){
		closable = params.hasOwnProperty('closable')?params.closable:true;
		ismodal = params.hasOwnProperty('modal')?params.modal:true;
		w = params.hasOwnProperty('width')?params.width:400;
		h = params.hasOwnProperty('height')?params.height:400;
	}
	if(alert_window == null){
		var options = {
		  width: w,
		  height: h,
		  parent: parent_win,
		  modal: ismodal,
		  show:false,
		  frame: false,
		  'closable':closable,
		  webPreferences: {
		    nodeIntegration: true,
		    webSecurity: false,
		    allowRunningInsecureContent: true,
		  	preload: path.join(__dirname, 'alert.js')
		  }
		};
		update_win_options(options);
		alert_window = new BrowserWindow(options);
	}
	alert_window.once('ready-to-show', () => {
		if(callback){
			callback('ready', alert_window);
		}
		// var script_val = 'document.write(\'<h1>'+message+'</h1>\');';
		// alert_window.webContents.executeJavaScript(script_val).then((result)=>{
		// 	console.log('alert_window execute result:', result);
		// });
		alert_window.show();
	});
	alert_window.on('closed', () => {
	  if(callback){
		  callback('closed', alert_window);
	  }
	  alert_window = null;
	});
	alert_window.webContents.on('did-finish-load', () => {
	    alert_window.webContents.send('asynchronous-alert', {tag:'start', msg:message});
	  });
	alert_window.loadURL(`file://${__dirname}/empty.html`);
	return alert_window;
};

var show_alert = {
	show:function(message, parent_win, callback, params){
		if(!parent_win){
			parent_win = BrowserWindow.getFocusedWindow();
		}
		return createAlertWindow(message, parent_win, callback, params);
	},
};
module.exports = show_alert
