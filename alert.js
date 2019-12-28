const ele_remote = require('electron').remote;
if(ele_remote){
	var ipcRenderer = require('electron').ipcRenderer;
	// function send_log(){
	// 	ipcRenderer.send('asynchronous-spider-backend', {"tag":"console.log", "arguments":arguments, "source":current_tag});
	// }
	ipcRenderer.on('asynchronous-alert', function(event, args){
		// console.log("recv args:", args);
		current_tag = args.tag;
		if('start'==args.tag){
			var msg = args.msg;
			document.querySelector('#message').innerHTML = msg;
		}
	});
}