var utilities = require('./utilities')();
const log = utilities.getLogger();
var storage = require('./storage')();

module.exports = function () {

	var test_table = {

		insertTest: function(test, callback)
		{
			storage.getObject('Tests', function(response) {

				let n = response.length;
				let i = n - 1;

				while(i >= 0 && response[i].test_time > test.test_time) {
					i--;
				}

				response.splice(i+1, 0, test);

				storage.storeObject('Tests', response, function(status){
					log.info(response);
					utilities.executeCallback(callback, true);
				});

			});
		},

		insertTests: function(tests, callback)
		{
			storage.getObject('Tests', function(response) {

				for(let j = 0; j < tests.length; j++) {
					let n = response.length;
					let i = n - 1;
					while(i >= 0 && response[i].test_time > tests[j].test_time) {
						i--;
					}
					response.splice(i+1, 0, tests[j]);
				}
				
				storage.storeObject('Tests', response, function(status){
					utilities.executeCallback(callback, true);
				});

			});
		},

		popNextTest: function(callback) {
			storage.getObject('Tests', function(response) {
				if(response.length == 0) {
					utilities.executeCallback(callback, undefined);
				} else {
					let test = response.shift();

					storage.storeObject('Tests', response, function(status) {
						if(status == false) {
							log.info('Storing tests failes!');
							utilities.executeCallback(callback, {});							
						} else {
							utilities.executeCallback(callback, test);
						}
					}); 
				}
			});
		},

		nextTest: function(callback) {
			storage.getObject('Tests', function(response) {
				if(response.length == 0) {
					utilities.executeCallback(callback, undefined);
				} else {
					let test = response[0];

					storage.storeObject('Tests', response, function(status) {
						if(status == false) {
							log.error('Storing tests fails!');
							utilities.executeCallback(callback, {});							
						} else {
                          	log.info('Storing tests!');
                          	log.info(test);
							utilities.executeCallback(callback, test);
						}
					}); 
				}
			});
		},

		getTests: function(callback) {
			storage.getObject('Tests', function(response) {
				if(response.length == 0) {
					log.info('No tests it LevelDB');
					utilities.executeCallback(callback, []);
				} else {
					utilities.executeCallback(callback, response);
				}
			});
		}
	};

	return test_table;

};
