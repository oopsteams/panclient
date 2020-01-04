SELECT * from file_list a where a.task_id=1575690214620 and a.isdir=1; 608/2567

SELECT b.id as id, b.path as path, count(a.id) as cnt from file_list a, file_list b WHERE a.parent=b.id and a.task_id=1575690214620 and a.isdir=0 GROUP BY b.path;


update file_list set pin=0 where isdir=0 and task_id=1575901700377;
update file_list set pin=3 where isdir=1 and task_id=1575901700377;

select a.id, a.filename, b.id, b.filename, a.size, a.path from file_list a, file_list b where a.task_id=1575867993323 and a.isdir=0 and a.id<>b.id and a.size=b.size and a.parent=b.parent and (a.filename like b.filename||'%' or b.filename like a.filename||'%');
select a.id, a.filename, b.id, b.filename, a.size, a.path from file_list a, file_list b where a.task_id=1575867993323 and a.isdir=1 and a.id<>b.id and a.size=b.size and a.parent=b.parent and (a.filename like b.filename||'%');

select id,name from transfer_tasks;

select id, parent, filename, size from file_list where task_id= and parent=
delete from file_list where task_id= and parent=
delete from file_list where task_id= and id=

nodejs 验证 md5

var crypto = require('crypto');
var md5 = crypto.createHash('md5');
const fs = require('fs');
var final_file = '/Users/susy/._download/575694627572237/test.mp4';
const input = fs.createReadStream(final_file);
var md5_pipe = input.on('data', (chunk)=>{md5.update(chunk);}).on('end', 
()=>{
	var filemd5 = md5.digest('hex');
	console.log("filemd5:",filemd5);
	}
);


var params={
	bdstoken:'82c3dc0e7fae33c5a0da28b3a3a6347a',
	channel: 'chunlei',
	web: 1,
	app_id: 250528,
	logid: 'MTU3NjA2NDQ3NTM0OTAuNTUxNDU4OTQ0ODI2MDU0NQ==',
	clienttype: 0
}
var formdata={
	from_uk: 1944188803,
	msg_id: '7293526278106259653',
	path: '/_tmp',
	ondup: 'newcopy',
	async: 1,
	type: 2,
	gid: '56162499896297783',
	fs_ids: [776621870309946]
}

select * from file_list where parent in ('321272493794807','948232608263580','511377925021327','1046137552057128','376397455377943','952049922161103','114260130615046')

var params = {
				msgid:'4121720200017697986',
				page:1,
				num:50,
				fromuk:'1944188803',
				_gid:'56162499896297783',
				ftype:2,
				fid:'935572148200347',
				bdtk:'82c3dc0e7fae33c5a0da28b3a3a6347a',
				ch:'chunlei',
				web_val:1,
				appid:250528,
				logid:baidu_api.build_log_id(),
				ctype:0
			};
			
var _gid='56162499896297783', stype=2,bdtk='82c3dc0e7fae33c5a0da28b3a3a6347a', ch='chunlei',web_val=1, appid=250528, ctype=0, pg=1, limit=3;
bd_proxy_api.get_share_list(_gid, stype, bdtk, ch, web_val, appid, ctype, pg, limit, (err, rs)=>{console.log(err, rs);});


var _last_msg_time = 1576069097,_gid='334007490507240132', gtype=1, bdtk='82c3dc0e7fae33c5a0da28b3a3a6347a', ch='chunlei',web_val=1, appid=250528, ctype=0;
bd_proxy_api.get_msg_list(_last_msg_time, _gid, gtype, bdtk, ch, web_val, appid, ctype, (err, rs)=>{console.log(err, rs);});

bd_proxy_api.fetch_group_list(bdtk, ch, web_val, appid, ctype, (err, rs)=>{console.log(err, rs);});
var _type=1, start=0, limit=20, bdtk='82c3dc0e7fae33c5a0da28b3a3a6347a', ch='chunlei',web_val=1, appid=250528, ctype=0;
bd_proxy_api.group_user_list(_type, bdtk, ch, web_val, appid, ctype, start, limit, (err, rs)=>{console.log(err, rs);});