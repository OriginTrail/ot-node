var utilities = require('./utilities')();
var storage = require('./storage')();

module.exports = function(){

	var holding = {
		addHoldingData: function(dh_wallet, data_id, public_key, callback) {
			storage.getObject('Holding', function(response) {

				if(response.length == 0)
				{
					response = {data:[]};
				}
				
				for(let i in response.data) {
					
					if (response.data[i].dh_wallet == dh_wallet && response.data[i].data_id == data_id)
					{
						utilities.executeCallback(callback, true);
						return;
					}
				}

				new_data = {dh_wallet: dh_wallet, data_id: data_id, public_key: public_key, confirmation_number: 0};
				console.log(JSON.stringify(new_data))
				response.data.push(new_data);

				storage.storeObject('Holding', response, function(status){
					utilities.executeCallback(callback, true);
				})

			})
		},

		getHoldingData: function(dh_wallet, data_id, callback) {
			storage.getObject('Holding', function(response) {

					if(response.length == 0 || response.data.length == 0) {
						utilities.executeCallback(callback, {});
						return;
					}
					
					for(let i in response.data) {

						if (response.data[i].dh_wallet == dh_wallet && response.data[i].data_id == data_id)
						{
							utilities.executeCallback(callback, response.data[i]);
							return;
						}

				}

				utilities.executeCallback(callback, {});

			})
		},	

		increaseConfirmationVerificationNumber: function(dh_wallet, data_id, callback) {
			storage.getObject('Holding', function(response) {

					if(response.length == 0)
					{
						utilities.executeCallback(callback, false);
						return;
					}

					for(let i in response.data) {
					
						if (response.data[i].dh_wallet == dh_wallet && response.data[i].data_id == data_id)
						{
							response.data[i].confirmation_number += 1;
						}
					}

					storage.storeObject('Holding',response, function(status){
						utilities.executeCallback(callback, true);
					})

				})
		}
	};

	return holding

}
