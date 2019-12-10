SELECT * from file_list a where a.task_id=1575690214620 and a.isdir=1; 608/2567

SELECT b.id as id, b.path as path, count(a.id) as cnt from file_list a, file_list b WHERE a.parent=b.id and a.task_id=1575690214620 and a.isdir=0 GROUP BY b.path;


update file_list set pin=0 where isdir=0 and task_id=1575901700377;
update file_list set pin=3 where isdir=1 and task_id=1575901700377;

select a.id, a.filename, b.id, b.filename, a.size, a.path from file_list a, file_list b where a.task_id=1575867993323 and a.isdir=0 and a.id<>b.id and a.size=b.size and a.parent=b.parent and (a.filename like b.filename||'%' or b.filename like a.filename||'%');
select a.id, a.filename, b.id, b.filename, a.size, a.path from file_list a, file_list b where a.task_id=1575867993323 and a.isdir=1 and a.id<>b.id and a.size=b.size and a.parent=b.parent and (a.filename like b.filename||'%' or b.filename like a.filename||'%');

select id,name from transfer_tasks;

select * from file_list where task_id= and parent=
delete from file_list where task_id= and parent=
delete from file_list where task_id= and id=
