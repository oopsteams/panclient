const {BrowserWindow} = require('electron')

var alert_window = null;
var createAlertWindow =(message, parent_win, callback) => {
	if(alert_window == null){
		alert_window = new BrowserWindow({
		  width: 400,
		  height: 400,
		  parent: parent_win,
		  modal: true,
		  show:false,
		  frame: true
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
};

var show_alert = {
	show:function(message, parent_win, callback){
		if(!parent_win){
			parent_win = BrowserWindow.getFocusedWindow();
		}
		createAlertWindow(message, parent_win, callback);
	},
};
module.exports = show_alert
