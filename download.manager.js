const request = require('request');
const low =  require('lowdb');
const FileSync = require('lowdb/adapters/FileSync')
const fs = require('fs');
const Base = require("./base.js")

const download_adapter = new FileSync('download_db.json')
const download_pos_adapter = new FileSync('download_pos_db.json')
const download_db = low(download_adapter);
const download_pos_db = low(download_pos_adapter);

var CrossFileLoader = Base.extend({
	
});