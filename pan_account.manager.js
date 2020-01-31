var table_format = '<table width="100%" class="gridtable"><tbody></tbody></table>'
// var item_format = '<h3 id="_id__h"><table width="100%" class="gridtable"><tr id="_id__tr"><td style="width:140px;"><div style="width:140px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;" title="_title_">_title_</div></td><td><div id="_id__name" title="_title_"></div></td><td width="130px" id="_id__speed"></td><td width="40px"><button id="_id__btn">&nbsp;</button></td><td width="40px"><button id="_id__act_btn">&nbsp;</button></td></tr></table></h3><div id="_id__sub_container" style="max-height:120px" class="sub_container">&nbsp;</div>';
var item_format = '<tr id="_id__tr"><td style="width:140px;"><div style="width:140px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;" title="_title_">_title_</div></td><td><div id="_id__name" title="_title_"></div></td><td width="120px"><button id="_id__btn">重新授权</button></td></tr>';
var _id_reg = new RegExp("_id_", "g");
var _title_reg = new RegExp("_title_", "g");
var pan_acc_api = {
	show_dialog:function(pan_acc_list){
		var el = '#dialog_container';
		var pan_acc_container = $(el);
		console.log('pan_acc_container:', pan_acc_container);
		var tbody_obj = pan_acc_container.find('table tbody');
		if(!tbody_obj || tbody_obj.length==0){
			pan_acc_container.prepend($(table_format));
			tbody_obj = pan_acc_container.find('table tbody');
		}
		tbody_obj.html('');
		// pan_acc_container.accordion({heightStyle: "content",collapsible: true});
		for(var i=0; i<pan_acc_list.length; i++){
			var pan_acc = pan_acc_list[i];
			var target_id = pan_acc.id;
			var target_name = pan_acc.name;
			var task_dom = item_format.replace(_id_reg, target_id).replace(_title_reg, target_name);
			tbody_obj.prepend($(task_dom));
			var btn = $('#'+target_id+'_btn');
			btn[0].ctx = pan_acc;
			btn.on("click", function(event){
				var pan_acc=event.currentTarget.ctx;
				var pan_name = pan_acc.name;
				var pan_id = pan_acc.id;
				console.log('pan_acc:', pan_acc);
				ipcRenderer.send('asynchronous-message', {"tag":"reauth", "pan_acc": pan_acc});
				event.stopPropagation();
			});
		}
		
		
	}
};
module.exports = pan_acc_api;