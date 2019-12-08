if(require('electron').remote){
	var ipcRenderer = require('electron').ipcRenderer;
	ipcRenderer.on('asynchronous-login', function(event, args){
		console.log("recv args:", args);
		if('start'==args.tag){
			
		}
	});
	ipcRenderer.send('asynchronous-login-backend', {"tag":"click"});
}