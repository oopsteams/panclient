const { ipcRenderer } = require('electron')
const account_renderer = require('./account_renderer.js');
const download_ui = require('./download_ui.js');
var jQuery = $ = require("jquery");
// prints "pong"
// console.log(ipcRenderer.sendSync('synchronous-message', 'ping'))

// prints "pong"
// ipcRenderer.on('asynchronous-reply', (...args) => console.log(args))
var waiting_replay = {}
var progress_infos = {}
var init_call = null;
var dialog_max_width = 450;
////////////////update download tasks


ipcRenderer.on('asynchronous-reply', function(event, args){
	if(args && args.hasOwnProperty('tag')){
		var tag = args.tag;
		// console.log("args:", args);
		if("file" ==  tag){
			var id = args.id;
			if(waiting_replay[tag] == id){
				var item = args.item;
				if(['jpg', 'jpeg', 'png', 'gif', 'bmp'].indexOf(item.type)>=0){
					$('#data .image img').one('load', function () { 
						$(this).css({'marginTop':'-' + $(this).height()/2 + 'px','marginLeft':'-' + $(this).width()/2 + 'px'}); 
					}).attr('src',item.dlink);
					$('#data .default').hide();
					$('#data .image').show();
				} 
				if(item.isdir == 0){
					var _html = '<table class="gridtable">';
					var bit = 'K';
					var _size = item.size;
					if(_size>1024){
						_size = Math.round(_size/1024);
						bit = 'M';
					}
					// if(_size>1024){
					// 	_size = Math.round(_size/1024);
					// 	bit = 'G';
					// }
					_html += '<tr><td width="90px">文件名:</td>'
					_html += '<td>'+item.filename+'</td></tr>'
					_html += '<tr><td>大小:</td>'
					_html += '<td>'+_size+'['+bit+']</td></tr>'
					_html += '<tr><td>路径:</td>'
					_html += '<td>'+item.path+'</td></tr>'
					_html += '</table>';
					// console.log(_html);
					$('#data .default').html(_html).show();
					$('#data .image').hide();
				}
				$(".download").attr('data-item', JSON.stringify(item));
				
			}
		}else if("download" == tag){
			var info = args.info;
			$('#default_msg').html(info).show();
			$('#data .image').hide();
		}else if("progress" == tag){
			var id = args.id;
			var isover = args.over;
			progress_infos[''+id] = args.info;
			var info = '';
			for(var k in progress_infos){
				info = info + progress_infos[k] + '<br>'
			}
			// console.log("progress info:", info);
			$('#default_msg').html(info).show();
			$('#data .image').hide();
			if(isover){
				delete progress_infos[''+id];
			}
		}else if("sub_tasks" == tag){
			download_ui.update_sub_tasks(args)
		}else if("error" == tag){
			var info = args.error;
			$('#default_msg').html(info).show();
				$('#data .image').hide();
		}else if("ready" == tag){
			var tk = args.token;
			var pt = args.point;
			if(init_call){
				init_call(tk, pt);
			}
		}else if("synctasks" == tag){
			var tasks = args.tasks;
			// for(var loader_id in tasks){
			// 	var loader = tasks[loader_id];
			// 	console.log("loader:["+loader_id+"]:", loader);
			// }
			download_ui.update_download_tasks(tasks);
		}else if("recover_btn" == tag){
			var id = args.id;
			$("#"+id).button('enable');
		}
	}
});

// ipcRenderer.send('asynchronous-message', 'ping');


// html demo
var point = "http://127.0.0.1:8080/source/";
var __token = null;
// lazy demo
// window.account_renderer = account_renderer;
// window.addEventListener("message", (event) => {
// 	console.log('event:', event);
// 	account_renderer.quit();
// }, false);
var init_ui = ()=>{
	$( ".controlgroup" ).controlgroup();
	$("#net_disk").button({icon: "ui-icon-disk", showLabel: false}).on("click", function (event, ui) {
		$("#net_disk").button('disable');
		ipcRenderer.send('asynchronous-message', {"tag":"btn_click",
			"data": {}, 
			"id": 'net_disk'}
			);
	}).end();
	$("#download_list").button({icon: "ui-icon-grip-solid-horizontal", showLabel: false}).on("click", function (event, ui) {
		$("#download_list").button('disable');
		command('download');
		// ipcRenderer.send('asynchronous-message', {"tag":"btn_click", "data": {}, "id": 'download_list'});
	}).end();
	$("#self_sync_root").button({icon: "ui-icon-refresh", showLabel: false}).on("click", function (event, ui) {
		$("#self_sync_root").button('disable');
		ipcRenderer.send('asynchronous-message', {"tag":"btn_click",
			"data": {}, 
			"id": 'self_sync_root'}
			);
		setTimeout(()=>{$("#self_sync_root").button('enable');}, 5000);
	}).end();
	
};
var dialog = null;
$( function() {
	function ready_for_tree(token){
		jQuery.getScript("./www/js/jquery-ui/jquery-ui.js").done(function() {
			dialog = $("#dialog").dialog({
				autoOpen: false,
				height: 400,
				width: dialog_max_width,
				modal: true,
				buttons: {
					"Do": function () {

					},
					Cancel: function() {
						dialog.dialog( "close" );
					}
				},
				close: function(){$("#download_list").button('enable');},
				resize: function(){
					$("#accordion").accordion("refresh");
				}
			});
			$.getScript("./www/js/jquery-ui/jquery.cookie.min.js").done(function(){
				ready_for_search();
				loaded();
			});
			init_ui();
		}).fail(function() {
			//TODO
		});
		
		
		$(window).resize(function () {
			var h = Math.max($(window).height() - 100, 420);
			$('#container, #data, #tree').height(h).filter('.default').css('lineHeight', h + 'px');
		}).resize();
		$('#tree').jstree({
			'core' : {
				'data' : {
					"url" : point+"fload?lazy",
					"headers":{"SURI-TOKEN":token},
					"data" : function (node) {
						// console.log("lazy node:", node);
						let p = "/";
						let _params = { "id" : node.id, "path": p }
						if(node.data){
							$.extend(_params, node.data)
						}
						return _params;
					}
				},
				'check_callback' : function(o, n, p, i, m) {
					if(m && m.dnd && m.pos !== 'i') { return false; }
					if(o === "move_node" || o === "copy_node") {
						if(this.get_node(n).parent === this.get_node(p).id) { return false; }
					}
					return true;
				},
				'themes' : {
					'responsive' : false,
					'variant' : 'small',
					'stripes' : true
				}
			},
			'contextmenu' : {
				'items' : function(node) {
					var ctxmenu = $.jstree.defaults.contextmenu.items();
					console.log('contextmenu ctxmenu:', ctxmenu);
					delete ctxmenu.ccp;
					delete ctxmenu.remove;
					delete ctxmenu.rename;
					delete ctxmenu.create;
					ctxmenu.sync={
						"separator_after"	: false,
						"separator_before":false,
						"label":"同步",
						"action":(data)=>{
							var inst = $.jstree.reference(data.reference), node = inst.get_node(data.reference);
							console.log('sync inst:', inst);
							console.log('sync node:', node);
							node.id
							ipcRenderer.send('asynchronous-message', {"tag":"sync",
								"data": node.data, 
								"id": node.id, 
								"name": node.text}
								);
						}
					};
					if(this.get_type(node) === "file") {
						delete ctxmenu.sync;
					}
					return ctxmenu;
					// tmp.create.label = "New";
					// tmp.create.submenu = {
					// 	"create_folder" : {
					// 		"separator_after"	: true,
					// 		"label"				: "Folder",
					// 		"action"			: function (data) {
					// 			console.log('create_folder data:', data);
					// 			var inst = $.jstree.reference(data.reference),
					// 				obj = inst.get_node(data.reference);
					// 			inst.create_node(obj, { type : "default" }, "last", function (new_node) {
					// 				setTimeout(function () { inst.edit(new_node); },0);
					// 			});
					// 		}
					// 	},
					// 	"create_file" : {
					// 		"label"				: "File",
					// 		"action"			: function (data) {
					// 			console.log('create_file data:', data);
					// 			var inst = $.jstree.reference(data.reference),
					// 				obj = inst.get_node(data.reference);
					// 			inst.create_node(obj, { type : "file" }, "last", function (new_node) {
					// 				setTimeout(function () { inst.edit(new_node); },0);
					// 			});
					// 		}
					// 	}
					// };
				}
			},
			"types":{
				'#': {"valid_children": ["root"]},
				"root": {"valid_children":["default"]},
				'default': {'icon': 'folder', "valid_children": ["default","file"]},
				'file': {'valid_children': [], 'icon': 'glyphicon glyphicon-file'}
		  //   	'default' : { 'icon' : 'folder' },
				// 'file' : { 'valid_children' : [], 'icon' : 'file' }
			},
			'unique' : {
				'duplicate' : function (name, counter) {
					return name + ' ' + counter;
				}
			},
			"plugins" : [
				"contextmenu", "dnd", "search",
				"state", "types", "wholerow"
				// , "checkbox"
			  ]
		})
		.on('delete_node.jstree', function(e, data){
			console.log('delete_node:', e);
			// fail(function () {
			// 					data.instance.refresh();
			// 				})
		}).on('create_node.jstree', function(e, data){
			console.log('create_node:', e);
			console.log('create_node:', data.node);
			// done(function (d) {
			// 	data.instance.set_id(data.node, d.id);
			// })
			// .fail(function () {
			// 	data.instance.refresh();
			// });
		}).on('rename_node.jstree', function(e, data){
			console.log('rename_node:', e);
			// done(function (d) {
			// 	data.instance.set_id(data.node, d.id);
			// })
			// .fail(function () {
			// 	data.instance.refresh();
			// })
		}).on('move_node.jstree', function(e, data){
			console.log('move_node:', e);
			// done(function (d) {
			// 	//data.instance.load_node(data.parent);
			// 	data.instance.refresh();
			// })
			// .fail(function () {
			// 	data.instance.refresh();
			// })
		}).on('copy_node.jstree', function(e, data){
			console.log('copy_node:', e);
			// done(function (d) {
			// 	//data.instance.load_node(data.parent);
			// 	data.instance.refresh();
			// })
			// .fail(function () {
			// 	data.instance.refresh();
			// })
		}).on('show_contextmenu.jstree', function(node, x, y){
			console.log("show_contextmenu node:", node, x, y);
		}).on("search.jstree", function(nodes, str, res){
			console.log("search nodes:", nodes, str, res);
		}).on('changed.jstree', function(e, data){

			if(data && data.selected && data.selected.length) {
				$('#data .default').html("Loading...").show();
				// console.log("node :", data.node);
				if (data.node.data.isdir == 0) {
					$("p", "#dialog").html('The selected node is: ' + data.instance.get_node(data.selected[0]).text)
					// dialog.dialog("open");
					waiting_replay['file'] = data.node.id;
					ipcRenderer.send('asynchronous-message', {"tag":"file", 
						"data": data.node.data, 
						"id": data.node.id, 
						"name": data.node.text}
						);
				}
				/*
				cb:
				function (d) {
					if(d && typeof d.type !== 'undefined') {
						$('#data .content').hide();
						switch(d.type) {
							case 'text':
							case 'txt':
							case 'md':
							case 'htaccess':
							case 'log':
							case 'sql':
							case 'php':
							case 'js':
							case 'json':
							case 'css':
							case 'html':
								$('#data .code').show();
								$('#code').val(d.content);
								break;
							case 'png':
							case 'jpg':
							case 'jpeg':
							case 'bmp':
							case 'gif':
								$('#data .image img').one('load', function () { $(this).css({'marginTop':'-' + $(this).height()/2 + 'px','marginLeft':'-' + $(this).width()/2 + 'px'}); }).attr('src',d.content);
								$('#data .image').show();
								break;
							default:
								$('#data .default').html(d.content).show();
								break;
						}
					}
				}

				 */
			}else{
				$('#data .content').hide();
				$('#data .default').html('Select a file from the tree.').show();
			}
		});
    }
	if($('#tree').length>0){
		init_call = function(token, pt){
			point = pt + "source/";
			console.log("token,pt,point:", token, pt, point);
			__token = token;
			ready_for_tree(token);
		}
		// ipcRenderer.send('asynchronous-message', {"tag":"token"});
		ipcRenderer.send('asynchronous-message', {"tag":"ready"});
	}
    // $(document).contextmenu(function(event) {
    //     // dialog.dialog('open');
    //     // my_menu.menu('option', "disabled", true);
    //     // my_menu.menu( "option", "position", { my: "left top", of:event } );
    //     // console.log('contextmenu click!', event);
    //     // let node = $('#lazy').jstree(true).get_node(event.target);
    //     // if(node){
    //     // 	if (node.data.isdir == 1) {
    //     // 		my_menu.menu("option", "position", { my: "left top", at: "right-5 top+5" });
    //     // 	}
    //     // }
    //     // console.log('contextmenu jstree node:', node);
    //     // my_menu.menu( "option", "position", { my: "left top", at: "right-5 top+5" } );
    //     // my_menu.menu( "option", "position", { my: "left top", at: "right-5 top+5" } );
    //     return false;
    // });

	////////////////////////search by elasticsearch
	///
	function ready_for_search(){
		let page = 0;
		let has_next = false;
		let last_v = "";
		function update_tags(){
			let v = $('#keyword_input').val();
			if(v === last_v || v.length===0){
				return;
			}
			last_v = v;
			if(availableTags.indexOf(v)<0){
				availableTags.splice(0, 0, v);
				let _availableTags = availableTags.slice(0,50);
				let tags_str = _availableTags.join("`");
				console.log("tags_str:", tags_str);
				$.cookie('tags', tags_str, {expires: 365})
			}
			$("#list_container").html('');
			page = 0;
			has_next = false;
			// load_datas();
			tree_search();
		}
		let availableTags=[];
		let tags = $.cookie('tags')
		if(tags && tags.length>0){
			availableTags = tags.split("`");
		}
		$( "#keyword_input" ).autocomplete({
			source: availableTags
		}).keydown(function (e) {
			if(e.key === "Enter"){
				update_tags();
			}
		});
		$(".search").eq(0).button({icon: "ui-icon-search", showLabel: false}).on("click", function (event, ui) {
			console.log("event:", event);
			console.log("ui:", ui);
			console.log("keyword_input:", $('#keyword_input').val());
			update_tags();
		}).end();

		$(".download").eq(0).button({icon: "ui-icon-arrowrefresh-1-s", showLabel: true}).end().on("click", function (event, ui) {
			console.log("下载:", event);
			var dataset = event.currentTarget.dataset;
			console.log("下载 dataset:", dataset);
			var sec_idx = '';//$("#section_index").val()
			if(sec_idx.length>0){
				sec_idx = parseInt(sec_idx)
			} else {
				sec_idx = -1;
			}
			if(sec_idx>=0){
				ipcRenderer.send('asynchronous-message', {"tag":"redownload",
							"data": dataset.item, "section_index": sec_idx}
							);
			} else {
				ipcRenderer.send('asynchronous-message', {"tag":"download",
							"data": dataset.item}
							);
			}
			
		}).end();

		let accordion_instance = null;

		function load_datas() {
			let v = $('#keyword_input').val();
			if(v.length>0){
				$.ajax({
					url:"/source/load",
					data:{kw: v, page: page},
					dataType:"json",
					method:"POST",
					contentType:"application/x-www-form-urlencoded; charset=UTF-8",
				}).done(function(res){
					console.log("load rs:", res);
					// let file_list = res['data'];
					// console.log("load file_list:", file_list);
					// has_next = res['has_next'];
					// let container = $("#list_container")
					// $.each(file_list, function (index, item) {
					//     $('<h3/>', {html: item.filename}).appendTo(container);
					//     let sub_con = $('<div/>', {html: item.path}).appendTo(container);
					//     if(item['isdir'] === 0){
					//         $('<a/>', {html: "进入下载页", href: "/source/dlink?id="+item['id'], target: "_blank"}).appendTo(sub_con);
					//     }
					//     console.log("item:", item);
					// });
					// build_page_nav();
					// if(!accordion_instance){
					//     console.log("build new accordion_instance:", accordion_instance);
					//     accordion_instance = $( "#list_container" );
					//     accordion_instance.accordion({
					//         beforeActivate: function (event, ui) {
					//             console.log("event,ui:", event, ui)
					//         }
					//     });
					// }else{
					//     console.log("build refresh accordion_instance:", accordion_instance);
					//     accordion_instance.accordion("refresh");
					// }
				});
			}
		}
		var to = false;
		function tree_search(){
			let v = $('#keyword_input').val();
			if(v.length>0){
				if(to) { clearTimeout(to); }
				to = setTimeout(function () {
					$('#tree').jstree(true).search(v);
				}, 250);
			}
		}
		function build_page_nav() {
			if(has_next){
				$(".next").show();
			} else {
				$(".next").hide();
			}
			if(page===0){
				$(".pre").hide();
			}else{
				$(".pre").show();
			}
		}
		$(".next").click(function () {
		   page = page + 1;
		   load_datas();
		});
		$(".pre").click(function () {
		   page = page - 1;
		   if(page<0){
			   page = 0;
		   }
		   load_datas();
		});
	}

// build_page_nav();
///
/////////////////////////search end
	function loaded(){
		ipcRenderer.send('asynchronous-message', {"tag":"loaded"});
		$( document ).tooltip();
	}
} );
function command(tag){
	if('download' == tag){
		if(dialog){
			dialog.dialog( "open" );
		}
	}
	
	return true;
}
