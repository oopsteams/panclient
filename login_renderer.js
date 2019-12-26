if(require('electron').remote){
	var ipcRenderer = require('electron').ipcRenderer;
	ipcRenderer.on('asynchronous-login', function(event, args){
		console.log("recv args:", args);
		if('start'==args.tag){
			
		}
	});
	// ipcRenderer.send('asynchronous-login-backend', {"tag":"click"});
	window.to_login = function(isok){
				if(!isok){
					token = "error";
				}
				var mobile_no = document.getElementById("username").value;
				var password = document.getElementById("password").value;
				ipcRenderer.send('asynchronous-login-backend', 
				{"tag":"click", "context":{"mobile_no": mobile_no, "password": password}});
			};
}