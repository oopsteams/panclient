const {BrowserWindow, ipcRenderer} = require('electron');
const async = require('async');
const helpers = require("./helper.core.js")
const request = require('request');
var checkWindow = null;
var api = {
	check_code:function(token, point, redirect_url, parent_win, callback){
		if(redirect_url && parent_win){
			console.log('callback:',callback);
			createCheckWindow(token, point, redirect_url, parent_win, callback);
		}
	},
	close_check_window:function(){
		if(checkWindow){
			checkWindow.close()
		}
	}
};
function call_pansite_by_post(point, path, params, parent_win, callback){
	var ithis = this;
	
	this.query_file_head_running = true;
	headers = {"SURI-TOKEN": "login", "Content-Type": "application/x-www-form-urlencoded"};
	var data = JSON.stringify(params);
	var options = {
		method: 'POST',
		url: point + path,
		followRedirect: false,
		followOriginalHttpMethod: true,
		timeout: 120000,
		strictSSL: false,
		form: params,
		headers: headers
	};
	request(options, function(error, response, body){
		var json_obj = JSON.parse(body);
		checkWindow.close();
		if(json_obj){
			if(json_obj.hasOwnProperty('access_token')){
				callback(true);
				return;
			}
		}
		callback(false);
		//console.log("call_pansite_by_post json_obj:", json_obj);
	});
}
var createCheckWindow =(token, point, redirect_url, parent_win, callback) => {
	if(checkWindow == null){
		checkWindow = new BrowserWindow({
		  width: 700,
		  height: 500,
		  parent: parent_win,
		  modal: false,
		  show:true,
		  webPreferences: {
		    webSecurity: false,
		    allowRunningInsecureContent: true
		  }
		});
	}
	
	checkWindow.once('ready-to-show', () => {
		console.log("to show!!!");
		// checkWindow.show();
	});
	checkWindow.on('closed', () => {
	  checkWindow = null;
	});
	checkWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures)=>{
		console.log("options:", options);
		console.log("frameName:", frameName);
		event.preventDefault();
	}).on('did-get-response-details', (event, status, newURL, originalURL, httpResponseCode, requestMethod, referrer, headers, resourceType)=>{
		console.log('response-details, event:',event);
		console.log('response-details, status:',status);
		console.log('response-details, newURL:',newURL);
		console.log('response-details, originalURL:', originalURL);
		console.log('response-details, httpResponseCode:',httpResponseCode);
		console.log('response-details, requestMethod:',requestMethod);
		console.log('response-details, referrer:',referrer);
		console.log('response-details, headers:',headers);
		console.log('response-details, resourceType:',resourceType);
	}).on('did-finish-load', (event, errorCode, errorDescription, validateURL, isMainFrame)=>{
		console.log('did-finish-load, event:',event);
		console.log('did-finish-load, errorCode:',errorCode);
		console.log('did-finish-load, errorDescription:',errorDescription);
		console.log('did-finish-load, validateURL:', validateURL);
		console.log('did-finish-load, isMainFrame:', isMainFrame);
		checkWindow.webContents.executeJavaScript('document.getElementById("Verifier").value').then((result)=>{
			console.log('did-finish-load result:', result);
			call_pansite_by_post(point, "access_code/", {code: result, token: token}, parent_win, (isok)=>{
				// console.log("update access code success");
				callback(isok);
			});
		});
	});
	checkWindow.loadURL(redirect_url);
	// checkWindow.loadURL(`file://${__dirname}/login.html`);
}
module.exports = api;