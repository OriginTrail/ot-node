// External modules
const call_process = require('child_process').exec;
const utilities = require('./utilities')();
const blockchain = require('./blockchain')();
const product = require('./product')();
const async = require('async');

module.exports = function () {
	let importer = {

		importXML: function (ot_xml_document, selected_importer, callback) {
			call_process('python3 importers/' + selected_importer + '.py ' + ot_xml_document, function (error, stdout, stderr) {
				if (stderr) {
					console.log(stderr);
					utilities.executeCallback(callback, {
						message: 'Import failure',
						data: []
					});
				} else {
					let result = JSON.parse(stdout);
					let batch_uids_array = Object.keys(result.batches);

					async.each(batch_uids_array, function (batch_uid, next) {
						product.getTrailByUID(batch_uid, function (trailObject) {
							let trail = trailObject.graph;
							let bid = batch_uid;
							let bid_hash = utilities.sha3(bid);
							let trail_hash = product.hashTrail(trail, bid);

							blockchain.addFingerprint(bid, bid_hash, trail_hash);

							next();
						});
					}, function () {
						utilities.executeCallback(callback, {
							message: 'Import success',
							data: []
						});
					});
				}
			});
		}

	};

	return importer;
};
