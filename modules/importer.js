// External modules
const PythonShell = require('python-shell');
const utilities = require('./utilities')();
const log = utilities.getLogger();
const config = utilities.getConfig();
const Mtree = require('./mtree')();
const storage = require('./storage')();
const blockchain = require('./blockchain')();

const async = require('async');
const db = require('./database')();

const replication = require('./DataReplication');

module.exports = function () {
	let importer = {

		importJSON: async function (json_document, callback) {
			log.info('Entering importJSON');
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
								log.info('Import error!');
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
								log.info('Import error!');
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
				log.info('JSON import complete');
			});

			utilities.executeCallback(callback,true);
		},

		importXML: async function async (ot_xml_document, callback) {

			var options = {
				mode: 'text',
				pythonPath: 'python3',
				scriptPath: 'importers/',
				args: [ot_xml_document]
			};

			PythonShell.run('v1.5.py', options, function(stderr, stdout){

				if (stderr) {
					log.info(stderr);
					utilities.executeCallback(callback, {
						message: 'Import failure',
						data: []
					});
					return;
				} else {
					let result = JSON.parse(stdout);

					var vertices = result.vertices;
					var edges = result.edges;
					let import_id = result.import_id;
					

					let leaves = [];
					let hash_pairs = [];

					for(let i in vertices) {
						leaves.push(utilities.sha3(utilities.sortObject({identifiers: vertices[i].identifiers, data: vertices[i].data})));
						hash_pairs.push({key: vertices[i]._key, hash: utilities.sha3({identifiers: vertices[i].identifiers, data: vertices[i].data})});
					}

					let tree = new Mtree(hash_pairs);
					let root_hash = tree.root();

					log.info("Import id: " + import_id);
					log.info("Import root hash: " + root_hash);
					storage.storeObject('Import_'+import_id, {vertices: hash_pairs, root_hash: root_hash}, function(response) {
	/*					blockchain.addFingerprint(import_id, utilities.sha3(import_id), utilities.sha3(tree.root()), function(response) {
							console.log(response);
						});
	*/
						const graph = require('./graph')();
						const testing = require('./testing')();

						graph.encryptVertices(config.DH_NODE_IP, config.DH_NODE_PORT, vertices, result => {
							const encryptedVertices = result;
							log.info('[DC] Preparing to enter sendPayload');

							const data = {};
							data.vertices = vertices;
							data.edges = edges;
							data.import_id = import_id;

							replication.sendPayload(data, (result) => {
								log.info('[DC] Payload sent');
								log.info('[DC] Generating tests for DH');
							});



						});


					});

				}
			});
		}

	};

	return importer;
};

