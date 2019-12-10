const {BrowserWindow} = require('electron')

var alert_window = null;
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
		alert_window = new BrowserWindow({
		  width: w,
		  height: h,
		  parent: parent_win,
		  modal: ismodal,
		  show:false,
		  frame: true,
		  'closable':closable
		});
	}
	alert_window.once('ready-to-show', () => {
		if(callback){
			callback('ready', alert_window);
		}
		var script_val = 'document.write(\'<h1>'+message+'</h1>\');';
		alert_window.webContents.executeJavaScript(script_val).then((result)=>{
			console.log('alert_window execute result:', result);
		});
		alert_window.show();
	});
	alert_window.on('closed', () => {
	  if(callback){
		  callback('closed', alert_window);
	  }
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
