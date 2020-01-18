const ele_remote = require('electron').remote;
if(ele_remote){
	var jQuery = null;
	var ipcRenderer = require('electron').ipcRenderer;
	// function send_log(){
	// 	ipcRenderer.send('asynchronous-spider-backend', {"tag":"console.log", "arguments":arguments, "source":current_tag});
	// }
	ipcRenderer.on('asynchronous-alert', function(event, args){
		// console.log("recv args:", args);
		current_tag = args.tag;
		if('start'==args.tag){
			ipcRenderer.send('asynchronous-alert-backend', {"tag":"ready"});
		} else if('message' == args.tag){
			var msg = args.msg;
			document.querySelector('#message').innerHTML = msg;
		} else if('ready_ok' == args.tag){
			var params = args.params;
			if(!jQuery){
				window.jQuery = jQuery = $ = require("jquery");
				jQuery.getScript("./www/js/jquery-ui/jquery-ui.js").done(function() {
					console.log('load ui ok!');
					init_widget(params);
					ipcRenderer.send('asynchronous-alert-backend', {"tag":"init_ok"});
				});
			} else {
				init_widget(params);
				ipcRenderer.send('asynchronous-alert-backend', {"tag":"init_ok"});
			}
			// console.log('args:', args);
		}
	});
	var init_widget = ()=>{
		var close_btn = $('#close_btn');
		console.log('close_btn:', close_btn);
		close_btn.button({icon: "ui-icon-close", showLabel: true}).on('click',(e)=>{
			close_btn.button('disable');
			ipcRenderer.send('asynchronous-alert-backend', {"tag":"close"});
		}).end();
	};
}