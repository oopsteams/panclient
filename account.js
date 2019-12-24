const {BrowserWindow, ipcMain} = require('electron');
const helpers = require("./helper.core.js")
const async = require('async');
const Dao = require('./dao.js')
const check_access = require("./check_access_code.js")
const request = require('request');
// const low =  require('lowdb');
// const FileSync = require('lowdb/adapters/FileSync')
var path = require('path');
const os =  require('os');
var base_dir = os.homedir();
var data_dir = path.join(base_dir, helpers.data_dir_name);
var accounts_db = new Dao({'path': path.join(data_dir, "accounts"), 'type':'object', 'name':'accounts',
'fields':[{name:"id", type:'VARCHAR', len:130},
	{name:"default_save_path", type:'VARCHAR', len:512},
	{name:"tm", type:'INT'}
	]
});
// const adapter = new FileSync(path.join(data_dir, "accounts.json"))
// const accounts_db = low(adapter)
const token_timeout = 7*24*60*60*1000;
// if(!accounts_db.has('accounts').value()){
//   accounts_db.defaults({accounts:{}}).write();
// }
var loginWindow = null;
var api = {
	check_state:function(point, parent_win, callback){
		console.log("check_state in.");
		var user = accounts_db.get(null, null, (user)=>{
			console.log("user:", user);
			if(!user || !user['id']||helpers.now() - user['tm']>token_timeout){
				console.log('callback:',callback);
				createLoginWindow(point, parent_win, callback);
				// var js_str = 'window.open("'+`file://${__dirname}/login.html`+'","modal");';
				// console.log("js_str:",js_str);
				// parent_win.webContents.executeJavaScript(js_str);
				//callback(false);
			}else{
				callback(true);
			}
		});
	},
	update_default_save_path:function(path){
		accounts_db.put({default_save_path: path});
	},
	get_default_save_path:function(cb){
		accounts_db.get(null, null, (user)=>{
			console.log("user:", user);
			if(cb){
				if(user){
					cb(user.default_save_path);
				}else{
					cb(null);
				}
			}
		});
	},
	clear_token:function(){
		// accounts_db.get('accounts').assign({token: "", tm:0}).write();
		accounts_db.put({id: "", tm:0});
	},
	get_valid_token:function(cb){
		accounts_db.get(null, null, (user)=>{
			console.log("user:", user);
			if(cb){
				if(user){
					cb(user.id);
				}else{
					cb(null);
				}
			}
		});
	},
	close_login_window:function(){
		if(loginWindow){
			loginWindow.close()
		}
	}
};
function build_form_data(params){
	if(params){
		var rs = "";
		for(var k in params){
			if(rs.length == 0){
				rs = k+"="+params[k];
			} else {
				rs = rs + "&" + k+"="+params[k];
			}
		}
		return rs;
	}
	return ""
}
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
		console.log("body:", body)
		var json_obj = JSON.parse(body);
		if(!json_obj){
			callback({"state": -1, "msg":"account not exist!"})
			return;
		}
		need_renew_access_token = json_obj['need_renew_access_token'];
		auth_redirect = json_obj['auth'];
		token = json_obj['token'];
		console.log("need_renew_access_token:", need_renew_access_token);
		console.log("auth_redirect:", auth_redirect);
		console.log("token:", token);
		
		if(need_renew_access_token){
			check_access.check_code(token, point, auth_redirect, parent_win, (isok)=>{
				// console.log("check_code cb:");
				if(token){
					// accounts_db.get('accounts').assign({token: token, tm:helpers.now()}).write();
					accounts_db.put({id: token, tm:helpers.now()}, (params)=>{
						callback(isok);
					});
				} else {
					if(!isok){
						api.check_state(point, parent_win, callback);
					} else {
						callback(isok);
					}
				}
				
			});
		} else {
			if(token){
				// accounts_db.get('accounts').assign({token: token, tm:helpers.now()}).write();
				accounts_db.put({id: token, tm:helpers.now()}, (params)=>{
						callback(true);
					});
			} else {
				callback(true);
			}
		}
	})
}

var createLoginWindow =(point, parent_win, callback) => {
	if(loginWindow == null){
		loginWindow = new BrowserWindow({
		  width: 800,
		  height: 550,
		  parent: parent_win,
		  modal: true,
		  show:false,
		  webPreferences: {
		    webSecurity: false,
		    allowRunningInsecureContent: true,
		  	preload: path.join(__dirname, 'login_renderer.js')
		  }
		});
	}
	
	loginWindow.once('ready-to-show', () => {
		console.log("to show!!!");
		loginWindow.show();
	});
	loginWindow.on('closed', () => {
	  // Dereference the window object, usually you would store windows
	  // in an array if your app supports multi windows, this is the time
	  // when you should delete the corresponding element.
	  loginWindow = null;
	});
	loginWindow.webContents.on('did-finish-load', () => {
	    loginWindow.webContents.send('asynchronous-login', {tag:'start'});
	  });
	loginWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures)=>{
		if(frameName == "modal"){
			event.preventDefault();
			helpers.extend(options, {
				modal:true,
				parent:mainWindow,
				width:200,
				height:100
			});
			event.newGuest = new BrowserWindow(options);
		}else if(frameName == "info"){
			console.log("options:", options);
			event.preventDefault();
			async.map([options], (item, _callback)=>{if(item){
				loginWindow.close();
				if(!item.hasOwnProperty("mobile_no") || !item.hasOwnProperty("password")){
					callback(false);
					api.check_state(point, parent_win, callback);
				}else{
					var mobile_no = item['mobile_no'];
					var password = item['password'];
					call_pansite_by_post(point, "login/", {"mobile_no": mobile_no, "password": password}, parent_win, function(isok, res){
						if(isok){
							callback(true);
						} else {
							if(res['state'] == -1){
								callback(false);
								api.check_state(point, parent_win, callback);
							} else if(res['state'] == 0){
								callback(true);
							}
						}
					});
					
				}
				_callback(null, 'ok');
			}}, (err, result)=>{});
			
		}
	});
	ipcMain.on('asynchronous-login-backend', (event, args) => {
			console.log('ipcMain backend recv event:%s, args:%s', event, args);
			if('click'==args.tag){
				
			}
			
		});
	loginWindow.loadURL(`file://${__dirname}/login.html`);
};
module.exports = api