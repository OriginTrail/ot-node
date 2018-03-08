var utilities = require('./utilities')();
var storage = require('./storage')();

module.exports = function(){

	var holding = {
		addHoldingData: function(dh_wallet, data_id, public_key, callback) {
			storage.getObject('Holding', function(response) {

				if(response.length == 0)
				{
					response = {};
					response[dh_wallet] = [];
				}
				
				response[dh_wallet][data_id] = {data_id: data_id, public_key: public_key, confirmation_number: 0};

				storage.storeObject('Holding', response, function(status){
					utilities.executeCallback(callback, true);
				});

			});
		},

		getHoldingData: function(dh_wallet, data_id, callback) {
			storage.getObject('Holding', function(response) {

				if(response.length == 0 || response[dh_wallet][data_id] == undefined) {
					utilities.executeCallback(callback, {});
					return;
				}
				else {
					utilities.executeCallback(callback, response[dh_wallet][data_id]);
				}

			});
		},	

		increaseConfirmationVerificationNumber: function(dh_wallet, data_id, callback) {
			storage.getObject('Holding', function(response) {

				if(response.length == 0 || response[dh_wallet][data_id] == undefined)
				{
					utilities.executeCallback(callback, false);
					return;
				}
					
				console.log(response[dh_wallet][data_id]);
				response[dh_wallet][data_id].confirmation_number += 1;

				storage.storeObject('Holding', response, function(status){
					utilities.executeCallback(callback, true);
				});

			});
		}
	};

	return holding;

};