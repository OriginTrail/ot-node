var levelup = require('levelup')
var leveldown = require('leveldown')
var db = levelup(leveldown('./system'))
const utilities = require('./utilities')();

module.exports = function(){
	
	var storage = {
		storeObject: function(key, obj, callback) {
			db.put(key, JSON.stringify(obj), function (err) {
	  			if(err) {
	  				console.log('Storage error: ', err);		
	  				utilities.execute_callback(callback, true);
	  			}
	  		})
		},

		getObject: function(key) {
			db.get(key, function (err, value) {
			    if (err) {
			    	console.log('Storage: Key not found');
			    	utilities.execute_callback(callback, true);	
			    }

			    utilities.execute_callback(callback, JSON.parse(value));
			    
			  })
			})
		}
	}

	return storage;
}