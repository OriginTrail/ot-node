var levelup = require('levelup');
var leveldown = require('leveldown');
const utilities = require('./utilities')();
const log = utilities.getLogger();

	var db = levelup(leveldown('./system'),function(err, response) {});




module.exports = function(){
	
	var storage = {
		storeObject: function(key, obj, callback) {
			db.put(key, JSON.stringify(obj), function (err) {
				if(err) {
					log.info('Storage error: ', err);
					utilities.executeCallback(callback, false);
				}
				else {
				//	log.info('Stored key: ', key);
					utilities.executeCallback(callback, true);
				}
			});
		},

		getObject: function(key, callback) {
			db.get(key, function (err, value) {
				if (err) {
					//log.info('Storage: ' + err);
					utilities.executeCallback(callback, []);
				}
				else {
					utilities.executeCallback(callback, JSON.parse(value));
				}



			});
		}
		
	};

	return storage;
};