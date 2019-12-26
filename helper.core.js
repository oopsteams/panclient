const fs = require('fs');
var helpers = {
	// point:"http://192.168.0.101:8080/",
	point:"http://127.0.0.1:8080/",
	data_dir_name:"._datas",
	log_dir_name:"logs",
	noop: function() {},
	scale_size:function(get_size){
	  var bit = 'B';
	  var _size = get_size;
	  if(_size>1024){
	    _size = Math.round((_size/1024) * 10)/10;
	    bit = 'K';
	  } else {
		_size = Math.round(_size * 10)/10;
	  }
	  if(_size>1024){
	   _size = Math.round((_size/1024) * 10)/10;
	   bit = 'M';
	  }
	  return _size + bit;
	},
	uid: (function() {
		var id = 0;
		return function() {
			return id++;
		};
	}()),
	isNullOrUndef: function(value) {
		return value === null || typeof value === 'undefined';
	},
	isArray: function(value) {
		if (Array.isArray && Array.isArray(value)) {
			return true;
		}
		var type = Object.prototype.toString.call(value);
		if (type.substr(0, 7) === '[object' && type.substr(-6) === 'Array]') {
			return true;
		}
		return false;
	},
	isObject: function(value) {
		return value !== null && Object.prototype.toString.call(value) === '[object Object]';
	},
	isFinite: function(value) {
		return (typeof value === 'number' || value instanceof Number) && isFinite(value);
	},
	valueOrDefault: function(value, defaultValue) {
		return typeof value === 'undefined' ? defaultValue : value;
	},
	valueAtIndexOrDefault: function(value, index, defaultValue) {
		return helpers.valueOrDefault(helpers.isArray(value) ? value[index] : value, defaultValue);
	},
	callback: function(fn, args, thisArg) {
		if (fn && typeof fn.call === 'function') {
			return fn.apply(thisArg, args);
		}
	},
	each: function(loopable, fn, thisArg, reverse) {
		var i, len, keys;
		if (helpers.isArray(loopable)) {
			len = loopable.length;
			if (reverse) {
				for (i = len - 1; i >= 0; i--) {
					fn.call(thisArg, loopable[i], i);
				}
			} else {
				for (i = 0; i < len; i++) {
					fn.call(thisArg, loopable[i], i);
				}
			}
		} else if (helpers.isObject(loopable)) {
			keys = Object.keys(loopable);
			len = keys.length;
			for (i = 0; i < len; i++) {
				fn.call(thisArg, loopable[keys[i]], keys[i]);
			}
		}
	},
	arrayEquals: function(a0, a1) {
		var i, ilen, v0, v1;

		if (!a0 || !a1 || a0.length !== a1.length) {
			return false;
		}

		for (i = 0, ilen = a0.length; i < ilen; ++i) {
			v0 = a0[i];
			v1 = a1[i];

			if (v0 instanceof Array && v1 instanceof Array) {
				if (!helpers.arrayEquals(v0, v1)) {
					return false;
				}
			} else if (v0 !== v1) {
				// NOTE: two different object instances will never be equal: {x:20} != {x:20}
				return false;
			}
		}

		return true;
	},
	clone: function(source) {
		if (helpers.isArray(source)) {
			return source.map(helpers.clone);
		}

		if (helpers.isObject(source)) {
			var target = {};
			var keys = Object.keys(source);
			var klen = keys.length;
			var k = 0;

			for (; k < klen; ++k) {
				target[keys[k]] = helpers.clone(source[keys[k]]);
			}

			return target;
		}

		return source;
	},
	_merger: function(key, target, source, options) {
		var tval = target[key];
		var sval = source[key];

		if (helpers.isObject(tval) && helpers.isObject(sval)) {
			helpers.merge(tval, sval, options);
		} else {
			target[key] = helpers.clone(sval);
		}
	},
	merge: function(target, source, options) {
		var sources = helpers.isArray(source) ? source : [source];
		var ilen = sources.length;
		var merge, i, keys, klen, k;

		if (!helpers.isObject(target)) {
			return target;
		}

		options = options || {};
		merge = options.merger || helpers._merger;

		for (i = 0; i < ilen; ++i) {
			source = sources[i];
			if (!helpers.isObject(source)) {
				continue;
			}

			keys = Object.keys(source);
			for (k = 0, klen = keys.length; k < klen; ++k) {
				merge(keys[k], target, source, options);
			}
		}

		return target;
	},
	mergeIf: function(target, source) {
		return helpers.merge(target, source, {merger: helpers._mergerIf});
	},
	extend: Object.assign || function(target) {
		return helpers.merge(target, [].slice.call(arguments, 1), {
			merger: function(key, dst, src) {
				dst[key] = src[key];
			}
		});
	},
	inherits: function(extensions) {
		var me = this;
		var BaseElement = (extensions && extensions.hasOwnProperty('constructor')) ? extensions.constructor : function() {
			return me.apply(this, arguments);
		};

		var Surrogate = function() {
			this.constructor = BaseElement;
		};

		Surrogate.prototype = me.prototype;
		BaseElement.prototype = new Surrogate();
		BaseElement.extend = helpers.inherits;

		if (extensions) {
			helpers.extend(BaseElement.prototype, extensions);
		}

		BaseElement.__super__ = me.prototype;
		return BaseElement;
	},
	now: function(){
		return Date.now();
	},
	check_json_result: function(result, callback){
		if(result.hasOwnProperty("result")){
			rs = result["result"]
			if(rs == "fail"){
				if(result.hasOwnProperty("state")){
					if(callback){
						callback(result["state"]);
					}
					return result["state"]
				}else{
					if(callback){
						callback(-9);
					}
					return -9;
				}
			}
		}
		return 1;
	},
	looper: (function(){
	  var _t = null;
	  var _all_listeners={};
	  function runner(){
	    var will_del = [];
	    for(var uid in _all_listeners){
	      var cb = _all_listeners[uid][0];
	      var _params = _all_listeners[uid][1];
	      if(cb(_params)){
	        will_del.push(uid);
	      }
	    }
	    for(var i=0;i<will_del.length;i++){
	      delete _all_listeners[will_del[i]];
	    }
	    if(_looper.running){
	      clearTimeout(_t);
	      _t = setTimeout(runner, 1000);
	    }
	  }
	  var _looper = {
	    running:false,
	    stop:function(){
	      _looper.running=false;
	      if(_t != null){
	        clearTimeout(_t);
	        _t = null;
	      }
	    },
	    start:function(){
	      if(!_looper.running){
	        _looper.running = true;
	        // console.log('start looper!!');
	        _t = setTimeout(runner, 1000);
	      }
	    },
	    removeListener:function(uid){
	      if(_all_listeners.hasOwnProperty(uid)){
	        delete _all_listeners[uid];
	      }
	    },
	    addListener:function(uid, callback, params){
	      _all_listeners[uid] = [callback, params];
	    }
	  };
	  return _looper;
	})(),
	append_merge_files:function(files, final_file, callback){
		// var _files = JSON.parse(JSON.stringify(files));
		if(files.length == 1){
			fs.rename(files[0], final_file, (err)=>{
				callback(err);
			});
			return;
		}
		if(files.length == 0){
			return;
		}
	  target_fs = fs.createWriteStream(final_file);
	  function cb(){
	    if(!files.length){
	      target_fs.end();
	      callback(null);
	      return;
	    }
	    stream = fs.createReadStream(files.shift());
	    stream.pipe(target_fs, {end: false});
	    stream.on("end", function(){
	      cb();
	    });
	  }
	  cb();
	}
};
module.exports = helpers;