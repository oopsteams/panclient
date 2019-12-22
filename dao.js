const Base = require("./base.js")
const helpers = require("./helper.core.js")
const util = require('util');
const sqlite3 = require('sqlite3').verbose();
// const low =  require('lowdb');
// const FileSync = require('lowdb/adapters/FileSync')
const os =  require('os');
var path = require('path');
var base_dir = os.homedir();
var data_dir = path.join(base_dir, helpers.data_dir_name);
const g_db_name = ".datas";
const create_table_format = 'CREATE TABLE IF NOT EXISTS %s (%s)';
const g_db_file_path = path.join(data_dir, g_db_name);
const g_db = new sqlite3.Database(g_db_file_path,function(err) {
				if(err){
					const g_db = new sqlite3.Database(g_db_file_path,(err)=>{
						if(err){
							throw err;
						} else {
							console.log("创建DB成功!", g_db_file_path);
						}
					});
				} else {
					console.log("创建DB成功!", g_db_file_path);
				}
			});
var Dao = Base.extend(
	{
		constructor:function(options){
		    this.options = options;
			this.path = options.path;
			this.type = options.type;
			this.name = options.name;
			this.db = g_db;
			this.fields = options.fields;
			this.id_field = null;
			this.init();
		},
		init:function(){
			var ithis = this;
			if(this.fields){
				var fields_tokens = "";
				this.fields.forEach((f, index)=>{
					if(fields_tokens.length > 0){
						fields_tokens += ",";
					}
					// console.log('f:', f.name, f.type);
					var suffix = "";
					if(f.name=='id'){
						ithis.id_field = f;
						suffix = " PRIMARY KEY";
					}
					fields_tokens += "" + f.name + " " + f.type + (f.hasOwnProperty('len')?"("+f.len+")":"") + suffix;
					
				});
				// console.log("fields_tokens:",fields_tokens);
				var create_sql = util.format(create_table_format, this.name, fields_tokens);
				this.db.run(create_sql);
			}
		},
		find_field_by_name:function(name){
			for(var i=0;i<this.fields.length;i++){
				var f = this.fields[i];
				if(f.name == name){
					return f;
				}
			}
		},
		sqlite_escape:function(val){
			if(val){
				var reg = new RegExp("'", "g");
				val = (''+val).replace(reg, "''");
			}
			return val;
		},
		format_val_by_type:function(f, val, suffix_str){
			if(!suffix_str){
				suffix_str = '';
			}
			if(f.type == 'INT'){
				return util.format('%d', val);
			}else if(f.type == 'BIGINT'){
				var s = val.toPrecision(64);
				var idx = s.indexOf('.');
				if(idx>=0){
					s = s.substring(0, idx);
				}
				return s;
			}else if(f.type == 'REAL'){
				return val.toPrecision(64);
			}else if(f.type == 'VARCHAR'){
				val = this.sqlite_escape(val);
				return util.format("'%s%s'", val, suffix_str);
			}else if(f.type == 'CHAR'){// 存储YYYY-MM-DD HH:MM:SS格式的日期
				return util.format("'%s%s'", val, suffix_str);
			}else if(f.type == 'TEXT'){ // 存储YYYY-MM-DD HH:MM:SS.SSS格式的日期
				val = this.sqlite_escape(val);
				return util.format("'%s%s'", val, suffix_str);
			}else if(f.type == 'DATETIME'){
				return util.format("'%s'", val);
			}
		},
		mapping_to_insert_sql:function(item){
			var f_n_list = [];
			var val_list = [];
			if(item){
				for(var i=0;i<this.fields.length;i++){
					var f = this.fields[i];
					if(item.hasOwnProperty(f.name)){
						f_n_list.push(f.name);
						val_list.push(this.format_val_by_type(f, item[f.name]))
					}
				}
			}
			return {fn: f_n_list, vals:val_list}
		},
		put:function(item, cb){
			var ithis = this;
			var mapping_list = this.mapping_to_insert_sql(item);
			// console.log('put mapping_list:', mapping_list);
			// console.log('put item:', item);
			var inst_sql = 'insert into ' + this.name + '('+mapping_list.fn.join(',')+') values(' + mapping_list.vals.join(',') + ')';
			// console.log('put inst_sql:',inst_sql);
			if("list" == this.type){
				// this.db.get(this.name).push(item).write()
				if(item){
					this.db.serialize(function(){
						ithis.db.run(inst_sql, (err)=>{
							if(err != null){
								console.log("err, inst_sql:",inst_sql);
								throw err;
							}
							if(cb){
								cb(item);
							}
						});
					});
				}
			} else {
				var query_rows = "select * from " + this.name;
				this.db.get(query_rows, (err, row)=>{
					if(err != null){
						throw err;
					}
					if(row){
						console.log("find row:", row);
						var id = row.id;
						ithis.update_by_id(id, item, cb);
					} else {
						console.log('not found user row,inst_sql:', inst_sql);
						ithis.db.run(inst_sql, (err)=>{
							if(err != null){
								throw err;
							}
							if(cb){
								cb(item);
							}
						});
					}
				});
				// this.db.get(this.name).assign(item).write();
			}
		},
		update_by_conditions: function(conditions, params, cb){
			var ithis = this;
			var where_str = '';
			for(var k in conditions){
				var _f = this.find_field_by_name(k);
				var value = conditions[k];
				if(_f){
					if(where_str.length == 0){
						where_str = k + "=" + this.format_val_by_type(_f, value);
					} else {
						where_str += " and "+ k + "=" + this.format_val_by_type(_f, value);
					}
				}
			}
			if(where_str.length == 0){
				cb(conditions, params);
				return;
			}
			var mapping_list = this.mapping_to_insert_sql(params);
			var set_sql = "";
			mapping_list.fn.forEach((fn, idx)=>{
				if(fn != 'id'){
					if(set_sql.length>0)set_sql += ",";
					set_sql += fn + "=" + mapping_list.vals[idx];
				}
			});
			var up_sql = "update "+this.name+" set " + set_sql + " where " + where_str;
			this.db.run(up_sql, (err)=>{
				if(err != null){
					console.log("err, update_by_conditions up_sql:",up_sql);
					throw err;
				}
				if(cb){
					cb(conditions, params);
				}
			});
		},
		update_by_id:function(id, params, cb){
			var mapping_list = this.mapping_to_insert_sql(params);
			var set_sql = "";
			var db_id_val = id;
			if(this.id_field){
				db_id_val = this.format_val_by_type(this.id_field, id);
			}
			mapping_list.fn.forEach((fn, idx)=>{
				if(fn != 'id'){
					if(set_sql.length>0)set_sql += ",";
					set_sql += fn + "=" + mapping_list.vals[idx];
				}
			});
			var up_sql = "update "+this.name+" set " + set_sql + " where id=" + db_id_val;
			// console.log("update_by_id up_sql:",up_sql);
			this.db.run(up_sql, (err)=>{
				if(err != null){
					console.log("err, update_by_id up_sql:",up_sql);
					throw err;
				}
				if(cb){
					cb(id, params);
				}
			});
			// if("list" == this.type){
			// 	this.db.get(this.name).find({'id': id}).assign(params).write()
			// } else {
			// 	this.db.get(this.name).assign(params).write();
			// }
		},
		get:function(key, value, cb){
			var ithis = this;
			if(key && value){
				var _f = this.find_field_by_name(key);
				var query_rows = "select * from " + this.name + " where " + key + "=" + this.format_val_by_type(_f, value);
				// console.log("get query_rows:", query_rows);
				ithis.db.get(query_rows, (err, row)=>{
					if(cb){
						if(row){
							cb(row);
						}else{
							cb(null);
						}
					}
				});
			} else {
				var query_rows = "select * from " + this.name;
				
				ithis.db.get(query_rows, (err, row)=>{
					if(err != null){
						throw err;
					}
					// console.log("cb err, row:", err, row);
					if(cb){
						if(row){
							cb(row);
						}else{
							cb(null);
						}
					}
				});
			}
		},
		query:function(key, value, cb){
			var ithis = this;
			var _f = this.find_field_by_name(key);
			var query_rows = "select * from " + this.name + " where " + key + "=" + this.format_val_by_type(_f, value);
			// console.log("query query_rows:",query_rows);
			ithis.db.all(query_rows, (err, rows)=>{
				if(err != null){
					console.log("err, query_rows:",query_rows);
					throw err;
				}
				if(cb){
					cb(rows);
				}
			});
			
		},
		query_count:function(params, cb){
			var ithis = this;
			var where_str = '';
			for(var k in params){
				var _f = this.find_field_by_name(k);
				var value = params[k];
				if(_f){
					if(where_str.length == 0){
						where_str = k + "=" + this.format_val_by_type(_f, value);
					} else {
						where_str += " and "+ k + "=" + this.format_val_by_type(_f, value);
					}
				}
			}
			var query_rows = "select count(*) as cnt from " + this.name + " where " + where_str;
			ithis.db.get(query_rows, (err, row)=>{
				if(err != null){
					console.log("err, query_rows:",query_rows);
					throw err;
				}
				if(cb){
					cb(row);
				}
			});
		},
		query_sum:function(key, params, cb){
			var ithis = this;
			var where_str = '';
			for(var k in params){
				var _f = this.find_field_by_name(k);
				var value = params[k];
				if(_f){
					if(where_str.length == 0){
						where_str = k + "=" + this.format_val_by_type(_f, value);
					} else {
						where_str += " and "+ k + "=" + this.format_val_by_type(_f, value);
					}
				}
			}
			var query_rows = "select sum("+key+") as val from " + this.name + " where " + where_str;
			ithis.db.get(query_rows, (err, row)=>{
				if(err != null){
					console.log("err, query_rows:",query_rows);
					throw err;
				}
				if(cb){
					cb(row);
				}
			});
		},
		query_mult_params:function(params, cb, size, offset, orderby){
			var ithis = this;
			var where_str = '';
			if(!orderby){
				orderby = '';
			}
			if(!offset){
				offset = 0;
			}
			if(!size){
				size = 50;
			}
			for(var k in params){
				var _f = this.find_field_by_name(k);
				var value = params[k];
				if(_f){
					if(where_str.length == 0){
						where_str = k + "=" + this.format_val_by_type(_f, value);
					} else {
						where_str += " and "+ k + "=" + this.format_val_by_type(_f, value);
					}
				}
			}
			if(where_str.length == 0){
				cb([]);
				return;
			}
			var query_rows = "select * from " + this.name + " where " + where_str +" "+ orderby + " LIMIT "+ size +" OFFSET "+ offset;
			// console.log("query query_rows:",query_rows);
			ithis.db.all(query_rows, (err, rows)=>{
				if(err != null){
					console.log("err, query_rows:",query_rows);
					throw err;
				}
				if(cb){
					cb(rows);
				}
			});
			
		},
		update_by_raw_sql:function(sql, cb){
			var ithis = this;
			if(sql){
				ithis.db.run(sql, (err, result)=>{
					if(err != null){
						console.log("err, update_by_raw_sql:",sql);
						throw err;
					}
					if(cb){
						cb(result);
					}
				});
			} else {
				if(cb){
					cb([]);
				}
			}
		},
		query_by_raw_sql:function(sql, cb){
			var ithis = this;
			if(sql){
				ithis.db.all(sql, (err, rows)=>{
					if(err != null){
						console.log("err, query_by_raw_sql:",sql);
						throw err;
					}
					if(cb){
						cb(rows);
					}
				});
			} else {
				if(cb){
					cb([]);
				}
			}
		},
		query_start_with_params:function(params, cb, size, offset){
			var ithis = this;
			var where_str = '';
			if(!offset){
				offset = 0;
			}
			if(!size){
				size = 50;
			}
			for(var k in params){
				var _f = this.find_field_by_name(k);
				var value = params[k];
				if(_f){
					var suffix_str = "=" + this.format_val_by_type(_f, value);
					if(['VARCHAR', 'CHAR', 'TEXT'].indexOf(_f.type)>=0){
						suffix_str = " like " + this.format_val_by_type(_f, value, '%');
					}
					if(where_str.length == 0){
						where_str = k + suffix_str;
					} else {
						where_str += " and "+ k + suffix_str;
					}
				}
			}
			if(where_str.length == 0){
				cb([]);
				return;
			}
			var query_rows = "select * from " + this.name + " where " + where_str + " LIMIT "+ size +" OFFSET "+ offset;
			// console.log("query query_rows:",query_rows);
			ithis.db.all(query_rows, (err, rows)=>{
				if(err != null){
					console.log("err, query_rows:",query_rows);
					throw err;
				}
				if(cb){
					cb(rows);
				}
			});
			
		},
		save_list_one_by_one:function(item_list,conflict_check_cb, mapping,cb){
			var self = this;
			function save_by_check(pos){
				if(pos>=item_list.length){
					cb(item_list);
					return;
				}
				var _item = mapping(item_list[pos]);
				if(_item && _item.hasOwnProperty('id')){
					self.get('id', _item.id, (_get_item)=>{
						if(!_get_item){
							self.put(_item, ()=>{
								save_by_check(pos+1);
							});
						}else{
							if(conflict_check_cb){
								conflict_check_cb(_item, _get_item, (update_it)=>{
									if(update_it){
										self.update_by_id(_item.id, update_it, ()=>{
											save_by_check(pos+1);
										});
									} else {
										save_by_check(pos+1);
									}
								});
							} else {
								save_by_check(pos+1);
							}
						}
					});
				} else if(_item) {
					self.put(_item, ()=>{
						save_by_check(pos+1);
					});
				} else {
					save_by_check(pos+1);
				}
			}
			save_by_check(0);
		},
		del:function(key, value, cb){
			var _f = this.find_field_by_name(key);
			var del_sql = "delete from "+ this.name + " where " + key + "=" + this.format_val_by_type(_f, value);
			// console.log("del query_rows:",del_sql);
			this.db.run(del_sql, (err, rows)=>{
				if(err != null){
					throw err;
				}
				if(cb){
					cb(rows);
				}
			});
		},
		close:function(){
		}
	}
);
Dao.close = ()=>{g_db.close();};
module.exports = Dao;