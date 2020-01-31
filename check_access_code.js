const {BrowserWindow, ipcRenderer, session} = require('electron');
// const async = require('async');
const urlib = require('url')
const helpers = require("./helper.core.js")
const request = require('request');
var checkWindow = null;
const filter = {
  urls: ['https://passport.baidu.com/*']
}
function parse_params(qs){
	var idx = qs.indexOf('?');
	if(idx>=0){
		qs = qs.substring(idx+1);
	}
	var rs = {};
	var params = qs.split('&');
	for(var i=0;i<params.length;i++){
		var entry = params[i].split('=');
		if(entry && entry.length>1){
			rs[entry[0]] = decodeURIComponent(entry[1]);
		}
	}
	return rs;
}
var gparams={'params':{}};
function interceptHttp(){
	// var self = this;
	session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
	  // callback({cancel: false, requestHeaders: details.requestHeaders})
	  if(details.method=='POST' && details.hasOwnProperty('uploadData')){
		  // console.log('details:', details);
		  var uds = details.uploadData;
		  if(uds.length>0){
			  var bf = uds[0].bytes;
			  var s = '';
			  for(var k=0;k<bf.length;k++){
			  	s += String.fromCharCode(bf[k]);
			  }
			  // console.log('s:',s);
			  gparams.params = parse_params(s);
			  console.log('post params:',gparams);
		  }
	  }
	  callback(details);
	})
	// this.win.webContents.send('asynchronous-spider',{'tag':'intercepted', 'st':0})
}
var api = {
	check_code:function(token, point, redirect_url, parent_win, callback){
		if(redirect_url && parent_win){
			console.log('callback:',callback);
			createCheckWindow(null, token, point, redirect_url, parent_win, callback);
		}
	},
	check_code_by_pan_acc:function(pan_acc, token, point, redirect_url, parent_win, callback){
		if(redirect_url && parent_win){
			console.log('callback:',callback);
			createCheckWindow(pan_acc, token, point, redirect_url, parent_win, callback);
		}
	},
	loop_check_accounts:function(token, point, pan_acc_list, redirect_url, parent_win, callback){
		if(pan_acc_list && pan_acc_list.length>0){
			parent_win.webContents.send('asynchronous-reply', {"tag": "renew_pan_acc", "pan_acc_list":pan_acc_list});
		} else {
			api.check_code(token, point, redirect_url, parent_win, callback);
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
		// if(json_obj){
		// 	if(json_obj.hasOwnProperty('access_token')){
		// 		callback(true);
		// 		return;
		// 	}
		// }
		// callback(false);
		callback(json_obj);
		//console.log("call_pansite_by_post json_obj:", json_obj);
	});
}
var createCheckWindow =(pan_acc, token, point, redirect_url, parent_win, callback) => {
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
	var pan_name = '';
	if(pan_acc && pan_acc.hasOwnProperty('name') && pan_acc.name){
		pan_name = pan_acc.name;
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
		// console.log('did-finish-load, event:',event);
		console.log('did-finish-load, errorCode:',errorCode);
		console.log('did-finish-load, errorDescription:',errorDescription);
		console.log('did-finish-load, validateURL:', validateURL);
		console.log('did-finish-load, isMainFrame:', isMainFrame);
		checkWindow.webContents.executeJavaScript('document.querySelector("input[name=userName]").value="'+pan_name+'";');
		checkWindow.webContents.executeJavaScript('document.getElementById("Verifier").value').then((result)=>{
			console.log('did-finish-load result:', result);
			var name = gparams.params.username;
			console.log('name:', name, ',code:', result,',token:', token);
			if(result){
				var r = pan_acc.refresh?1:0;
				call_pansite_by_post(point, "access_code/", {pan_name: name,code: result, token: token, refresh:r}, parent_win, (json_obj)=>{
					// console.log("update access code success");
					if(json_obj.hasOwnProperty('pan_acc_list')){
						var pan_acc_list = json_obj.pan_acc_list;
						pan_acc_list.forEach((pa, idx)=>{pa['token'] = token});
						var name = pan_acc.name;
						var auth_redirect = pan_acc.auth;
						//token, point, pan_acc_list, auth_redirect, parent_win
						parent_win.webContents.send('asynchronous-reply', {"tag": "renew_pan_acc", "pan_acc_list":pan_acc_list});
					} else {
						if(json_obj.hasOwnProperty('access_token')){
							callback(true);
							return;
						}
					}
					// if(json_obj.hasOwnProperty('access_token')){
					// 	callback(true);
					// 	return;
					// }
					// callback(false);
				});
				
			}
		});
	});
	console.log('to load:', redirect_url);
	interceptHttp();
	checkWindow.loadURL(redirect_url);
	// checkWindow.loadURL(`file://${__dirname}/login.html`);
}
module.exports = api;