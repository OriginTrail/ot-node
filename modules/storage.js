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
	  				utilities.executeCallback(callback, false);
	  			}
	  			else {
		  			utilities.executeCallback(callback, true)
	  			}
	  		})
		},

		getObject: function(key, callback) {
			db.get(key, function (err, value) {
			    if (err) {
			    	// console.log('Storage: Key not found');
			    	utilities.executeCallback(callback, []);	
			    }
			    else {
		  			utilities.executeCallback(callback, JSON.parse(value));
	  			}

			    
			    
			})
		}
		
	}

	return storage;
}