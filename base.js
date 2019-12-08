const helpers = require("./helper.core.js")

var Base = function(configuration){
	helpers.extend(this, configuration);
	this.initialize.apply(this, arguments);
}
helpers.extend(Base.prototype, {
	_type: undefined,

	initialize: function() {
		this.hidden = false;
	}

});

Base.extend = helpers.inherits;

module.exports = Base;