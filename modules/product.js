// External modules
var utilities = require('./utilities')();
const log = utilities.getLogger();
var database = require('./database')();
var graph = require('./graph')();
var Database = require('arangojs').Database;

var fs = require('fs');

module.exports = function () {
	// Private function
	function getProductJourney (virtual_graph_data, traversal) {
		var journey = [];
		var batches = [];
		var usedBatchUIDs = [];
		var batchUIDs = [];
		var transactions = [];
		var usedTransactionIDs = [];

		for (var i = 0; i < traversal.length; i++) {
			var point = traversal[i];
			if (point.vertex_type == 'BATCH' && usedBatchUIDs[point.identifiers.uid] != true) {
				var edges = point.outbound;

				for (j in edges) {
					if (edges[j].edge_type == 'INSTANCE_OF') {
						point.product_info = virtual_graph_data[edges[j].to];
					} else if (edges[j].edge_type == 'OUTPUT_BATCH' || edges[j].edge_type == 'OF_BATCH') {
						var event = virtual_graph_data[edges[j].to];
						event_edges = event.outbound;

						for (i in event_edges) {
							if (event_edges[i].edge_type == 'AT') {
								point.location = virtual_graph_data[event_edges[i].to];
							}
						}
					}
				}

				usedBatchUIDs[point.identifiers.uid] = true;
				batches.push(point);
			}

			if (point.vertex_type == 'TRANSACTION' && usedTransactionIDs[point.identifiers.TransactionId] != true) {
				var edges = point.outbound;

				usedTransactionIDs[point.identifiers.TransactionId] = true;
				transactions.push(point);
			}
		}

		var i = 1;
		var j = 0;

		if (batches.length > 0) {
			journey.push(batches[0]);
		}

		while (i < batches.length && j < transactions.length) {
			journey.push(transactions[j++]);
			journey.push(batches[i++]);
		}

		if (i < batches.length) {
			journey.push(batches[i]); 
		}

		return journey;
	}

 
	var product = {

		// Get trail by custom query
		// =========================
		getTrail: function (queryObject, callback) {
			var restricted = false;

			if (queryObject.restricted != undefined) {
				restricted = queryObject.restricted;
				delete queryObject.restricted;
			}

			graph.getVertices(queryObject, function (vertices) {
				if (vertices.length == 0) {
					utilities.executeCallback(callback, []);
					return;
				}

				var start_vertex = vertices[0];

				graph.getTraversal(start_vertex, function (raw_graph_data) {
					var virtual_graph_data = graph.convertToVirtualGraph(utilities.copyObject(raw_graph_data));

					var returnBFS = utilities.copyObject(virtual_graph_data);
					var BFSt = graph.BFS(utilities.copyObject(returnBFS.data), start_vertex.identifiers.uid, true);

					for (var i in BFSt) {
						if (BFSt[i].outbound != undefined) {
							delete BFSt[i].outbound;
						}
					}

					// Sorting keys in object for uniform response
					for (var i in BFSt) {
						BFSt[i] = utilities.sortObject(BFSt[i]);
					}

					var BFS = graph.BFS(utilities.copyObject(virtual_graph_data.data), start_vertex.identifiers.uid, restricted);
					var BFS_data = utilities.copyObject(graph.BFS(virtual_graph_data.data, start_vertex.identifiers.uid, restricted));

					var fetchedJourney = getProductJourney(utilities.copyObject(virtual_graph_data.data), utilities.copyObject(BFS));
      

					var responseObject = {
						graph: virtual_graph_data.data,
						traversal: BFSt,
						journey: fetchedJourney,
						sha3: utilities.sha3(JSON.stringify(BFSt))
					};

					utilities.executeCallback(callback, responseObject);
				});
			});
		},
		// =========================

		getTrailByUID: function (batch_uid, callback) {
			var queryObject = {
				uid: batch_uid,
				vertex_type: 'BATCH'
			};

			this.getTrail(queryObject, callback);
		},

		getTrailByQuery: function (queryObject, callback) {
			queryObject.vertex_type = 'BATCH';

			this.getTrail(queryObject, callback);
		},

		hashTrail: function (trail, start_vertex_uid) {
			var BFStraversal = graph.BFS(trail, start_vertex_uid, true);

			for (var i in BFStraversal) {
				if (BFStraversal[i].outbound != undefined) {
					delete BFStraversal[i].outbound;
				}
			}

			for (var i in BFStraversal) {
				BFStraversal[i] = utilities.sortObject(BFStraversal[i]);
			}

			var BFStraversalS = JSON.stringify(BFStraversal);

			// Import log entry
			fs.appendFile('import-log.txt', '\n\n-----------------\n UID: ' + start_vertex_uid + '\n\nUID hash: ' + utilities.sha3(start_vertex_uid) + '\n\nTraversal: ' + BFStraversalS + '\n\nTraversal hashed: ' + utilities.sha3(BFStraversalS) + '\n\n-----------------\n\n', 'utf8', function () {});

			return utilities.sha3(BFStraversalS);
		}

	};

	return product;
};
