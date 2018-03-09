const utilities = require('./utilities')();
const log = utilities.getLogger();

var db = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017";

var dbo = undefined;




module.exports = function(){

	var storage = {
		storeObject: function(key, obj, callback) {
			db.connect(url, function(err, db) {
			  dbo = db.db("origintrail");
				dbo.createCollection("ot_system", function(err, res) {
					dbo.collection("ot_system").findOne({key: key}, function(err, result) {

		 			if (result == null) {

						dbo.collection('ot_system').insertOne({key: key, data: obj}, function(err, res) {
							if (err) throw err;
							console.log("1 document inserted");
							utilities.executeCallback(callback, true);
							});
						db.close();
					}
					else
					{
						var query = { key: key};
	  					var newvalues = { $set: {key: key, data: obj } };
	  					dbo.collection("ot_system").updateOne(query, newvalues, function(err, res) {
						    if (result == null) {
						    	utilities.executeCallback(callback, false);
						    	db.close();
						    }
						  	else {
							    console.log("1 document updated");
							    utilities.executeCallback(callback, true);
							    db.close();
							  }
						  });

						}
					})

					  
					  
					});
				});			  
			  
	 		
		},

		getObject: function(key, callback) {
			db.connect(url, function(err, db) {
			  dbo = db.db("origintrail");
		 		dbo.collection("ot_system").findOne({key: key}, function(err, result) {

					if (err || result == null) {
					//	log.info('Storage: ' + err);
						utilities.executeCallback(callback, []);
					}
					else {
						utilities.executeCallback(callback, result.data);
					}
			
				});
			});

		}	
	};

	return storage;
};