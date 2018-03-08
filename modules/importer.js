// External modules
var PythonShell = require('python-shell');
const utilities = require('./utilities')();
//const blockchain = require('./blockchain')();
const product = require('./product')();
const async = require('async');
const db = require('./database')();
const replication = require('./DataReplication');

module.exports = function () {
	let importer = {

		importJSON: async function (json_document, callback) {
			var graph = json_document;
			await db.createVertexCollection('ot_vertices', function(){});
			await db.createEdgeCollection('ot_edges', function(){});

			let vertices = graph.vertices;
			let edges = graph.edges;
			let import_id = graph.import_id;

			async.each(vertices, function (vertex, next) {
				db.addVertex('ot_vertices', vertex, function(import_status) {
					if(import_status == false) {
						db.updateDocumentImports('ot_vertices', vertex._key, import_id, function(update_status) {
							if(update_status == false)
							{
								console.log('Import error!');
								return;
							}
							else
							{
								next();
							}
						});
					}
					else {
						next();
					}
				});
			}, function(){

			});

			async.each(edges, function (edge, next) {
				db.addEdge('ot_edges', edge, function(import_status) {
					if(import_status == false) {
						db.updateDocumentImports('ot_edges', edge._key, import_id, function(update_status) {
							if(update_status == false)
							{
								console.log('Import error!');
								return;
							}
							else
							{
								next();
							}
						});
					}
					else {
						next();
					}
				});
			}, function(){
				console.log('JSON import complete');
			});

			utilities.executeCallback(callback,true);
		},

		importXML: function async (ot_xml_document, callback) {

			var options = {
				mode: 'text',
				pythonPath: 'python3',
				scriptPath: 'importers/',
				args: [ot_xml_document]
			};

			PythonShell.run('v1.5.py', options, function(stderr, stdout){

				if (stderr) {
					console.log(stderr);
					utilities.executeCallback(callback, {
						message: 'Import failure',
						data: []
					});
					return;
				} else {
					let result = JSON.parse(stdout);
					// let batch_uids_array = Object.keys(result.batches);

					// async.each(batch_uids_array, function (batch_uid, next) {
					// 	product.getTrailByUID(batch_uid, function (trailObject) {
					// 		let trail = trailObject.graph;
					// 		let bid = batch_uid;
					// 		let bid_hash = utilities.sha3(bid);
					// 		let trail_hash = product.hashTrail(trail, bid);

					// 		//	blockchain.addFingerprint(bid, bid_hash, trail_hash);

					// 		next();
					// 	});
					// }, function () {
					// 	utilities.executeCallback(callback, {
					// 		message: 'Import success',
					// 		data: []
					// 	});
					// });

					let import_id = result.import_id;

					var vertices = [{_key: '1', identifiers: {a:1}, data: [1,2,3,4,5]},{_key: '2', identifiers: {a:2}, data:{a:'a',b:'b',c:'c'}},{_key: '3', identifiers: {a:3}, data:{a:['a','abc','def']}}];

					var edges = [{
						'_key': '12',
						'_from': 'ot_vertices/1',
						'_to': 'ot_vertices/2',
						'imports': []
					}, {
						'_key': '23',
						'_from': 'ot_vertices/2',
						'_to': 'ot_vertices/3',
						'imports': []
					}, {
						'_key': '31',
						'imports': [],
						'_from': 'ot_vertices/3',
						'_to': 'ot_vertices/1'
					}];

					const data = {};
					data.vertices = vertices;
					data.edges = edges;
					data.import_id = import_id;

					replication.sendPayload(data).then(res => {
						console.log(res);
					});

				}
			});
		}

	};

	return importer;
};

