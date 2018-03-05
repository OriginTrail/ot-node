// External modules
var PythonShell = require('python-shell');
const utilities = require('./utilities')();
const blockchain = require('./blockchain')();
const product = require('./product')();
const async = require('async');
const database = require('./database')()

module.exports = function () {
	let importer = {

		importJSON: function (json_document, callback) {

			graph = JSON.parse(json_document);
			console.log(graph);

		}

		importXML: function (ot_xml_document, callback) {

			var options = {
			  mode: 'text',
			  pythonPath: 'python3',
			  scriptPath: 'importers/',
			  args: [ot_xml_document]
			};

			PythonShell.run('default_importer.py', options, function(stderr, stdout){

				if (stderr) {
					console.log(stderr);
					utilities.executeCallback(callback, {
						message: 'Import failure',
						data: []
					});
				return;
				} else {
					let result = JSON.parse(stdout);
					let batch_uids_array = Object.keys(result.batches);

					async.each(batch_uids_array, function (batch_uid, next) {
						product.getTrailByUID(batch_uid, function (trailObject) {
							let trail = trailObject.graph;
							let bid = batch_uid;
							let bid_hash = utilities.sha3(bid);
							let trail_hash = product.hashTrail(trail, bid);

					//		blockchain.addFingerprint(bid, bid_hash, trail_hash);

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
