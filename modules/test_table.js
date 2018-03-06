var utilities = require('./utilities')();
var storage = require('./storage')();

module.exports = function () {

	var test_table = {

		insertTest: function(test, callback)
		{
			storage.getObject('Tests', function(response) {

				let n = response.length;
				let i = n - 1;

				while(i >= 0 && response[i].test_time > test.test_time)
					i--;

				response.splice(i+1, 0, test);

				storage.storeObject('Tests', response, function(status){
					console.log(response)
					utilities.executeCallback(callback, true);
					return;
				})

			})
		},

		popNextTest: function(callback) {
			storage.getObject('Tests', function(response) {
				if(response.length == 0) {
					utilities.executeCallback(callback, undefined)
				} else {
					let test = response.shift();

					storage.storeObject('Tests', response, function(status) {
						if(status == false) {
							console.log('Storing tests failes!')
							utilities.executeCallback(callback, {});							
						} else {
							utilities.executeCallback(callback, test);
						}
					}) 
				}
			})
		}
	}

	return test_table;

}