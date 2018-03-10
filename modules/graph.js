// External modules
const utilities = require('./utilities')();
//const log = utilities.getLogger();
const database = require('./database')();
const encryption = require('./encryption')();
const storage = require('./storage')();

const config = utilities.getConfig();
const MAX_PATH_LENGTH = parseInt(config.MAX_PATH_LENGTH);

module.exports = function () {
	let graph = {
		getVertices: function (queryObject, callback) { 
			let queryString = 'FOR v IN ot_vertices ';
			let params = {};
			if (utilities.isEmptyObject(queryObject) === false) {
				queryString += 'FILTER ';

				let filters = [];

				let i = 1;
				for (let key in queryObject) {
					if (key.match(/^[\w\d]+$/g) === null) {
						continue;
					}

					if(key != 'vertex_type' && key != '_key')
					{
						search_key = 'identifiers.' + key;
					}
					else
						search_key = key;

					const param = 'param' + i;
					filters.push('v.' + search_key + ' == @param' + i);
					i++;

					params[param] = queryObject[key];
				}

				queryString += filters.join(' AND ');
			}

			queryString += ' RETURN v';

			database.runQuery(queryString, function (result) {
				utilities.executeCallback(callback, result);
			}, params);
		},

		getTraversal: function (start_vertex, callback) {
			if (start_vertex === undefined || start_vertex._id === undefined) {
				utilities.executeCallback(callback, []);
				return;
			}

			let queryString = `FOR v, e, p IN 1 .. ${MAX_PATH_LENGTH}
					       OUTBOUND '${start_vertex._id}'
					       GRAPH 'origintrail_graph'
					       RETURN p`;

			database.runQuery(queryString, callback);
		},

		convertToVirtualGraph: function (raw_graph_data) {
			const vertices = {};
			const edges = {};
			const list = {};

			for (let i in raw_graph_data) {
				if (raw_graph_data[i].edges !== undefined) {
					for (let j in raw_graph_data[i].edges) {
						if (raw_graph_data[i].edges[j] != null) {
							raw_graph_data[i].edges[j].key = raw_graph_data[i].edges[j]._key;
							raw_graph_data[i].edges[j].from = raw_graph_data[i].edges[j]._from.split('/')[1];
							raw_graph_data[i].edges[j].to = raw_graph_data[i].edges[j]._to.split('/')[1];
							delete raw_graph_data[i].edges[j]._key;
							delete raw_graph_data[i].edges[j]._id;
							delete raw_graph_data[i].edges[j]._rev;
							delete raw_graph_data[i].edges[j]._to;
							delete raw_graph_data[i].edges[j]._from;

							let key = raw_graph_data[i].edges[j].key;

							if (edges[key] === undefined) {
								edges[key] = raw_graph_data[i].edges[j];
							}
						}
					}
				}

				if (raw_graph_data[i].vertices !== undefined) {
					for (let j in raw_graph_data[i].vertices) {
						if (raw_graph_data[i].vertices[j] != null) {
							raw_graph_data[i].vertices[j].key = raw_graph_data[i].vertices[j]._key;
							raw_graph_data[i].vertices[j].outbound = [];
							delete raw_graph_data[i].vertices[j]._key;
							delete raw_graph_data[i].vertices[j]._id;
							delete raw_graph_data[i].vertices[j]._rev;

							let key = raw_graph_data[i].vertices[j].key;

							if (vertices[key] === undefined) {
								vertices[key] = raw_graph_data[i].vertices[j];
							}
						}
					}
				}
			}

			for (let i in vertices) {
				list[vertices[i].key] = vertices[i];
			}

			for (let i in edges) {
				list[edges[i].from].outbound.push(edges[i]);
			}

			graph = {};
			graph['data'] = list;

			return graph;
		},

		BFS: function (trail, start_vertex_uid, restricted = false) {

			const visited = [];
			const traversalArray = [];

			let start_vertex = null;

			for (let i in trail) {
				if (trail[i].identifiers.uid === start_vertex_uid) {
					start_vertex = i;
					break;
				}
			}

			if (start_vertex != null) {
				const queue = [];
				queue.push(start_vertex);

				visited[start_vertex] = true;

				while (queue.length > 0) {
					const curr = queue.shift();

					if (trail[curr] === undefined) {
						continue;
					}

					traversalArray.push(trail[curr]);

					for (let i in trail[curr].outbound) {
						const e = trail[curr].outbound[i];
						const w = e.to;

						if (restricted && e.edge_type != 'TRANSACTION_CONNECTION') {
							traversalArray.push(e);
						}

						if (visited[w] === undefined && trail[w] !== undefined && !(e.edge_type == 'TRANSACTION_CONNECTION' && e.TransactionFlow == 'Output') && (restricted === false || (restricted === true && trail[w].vertex_type !== 'BATCH' && e.edge_type !== 'TRANSACTION_CONNECTION'))) {
							visited[w] = true;
							queue.push(w);
						}
					}
				}

				for (let i in traversalArray) {
					if (traversalArray[i]._checked !== undefined) {
						delete traversalArray[i]._checked;
					}
				}

				return traversalArray;
			} else {
				return traversalArray;
			}
		},

		encryptVertices: function(dh_ip, dh_port, vertices, callback) {

			storage.getObject('Keys', function(response) {
				if(response.length == 0)
				{
					var keypair = encryption.generateKeyPair();

					storage.storeObject('Keys', [{dh_ip: dh_ip, dh_port: dh_port, privateKey: keypair.privateKey, publicKey: keypair.publicKey}], function(response) {
			
						for(let i in vertices) {
							vertices[i].data = encryption.encryptObject(vertices[i].data, keypair.privateKey);
						}

						utilities.executeCallback(callback, {vertices: vertices, public_key: keypair.publicKey});
					})

				}
				else
				{
					for(let i in response) {
						if(response[i].dh_ip == dh_ip && response[i].dh_port == dh_port) {
							
							for(let j in vertices) {
								vertices[j].data = encryption.encryptObject(vertices[j].data, response[i].privateKey);
							}

							utilities.executeCallback(callback, {vertices: vertices, public_key: response[i].publicKey});
							return;
						}
					}

					var keypair = encryption.generateKeyPair();

					response.push({dh_ip: dh_ip, dh_port: dh_port, privateKey: keypair.privateKey, publicKey: keypair.publicKey});

					storage.storeObject('Keys', response, function(response) {

						for(let i in vertices) {
								vertices[i].data = encryption.encryptObject(vertices[i].data, keypair.privateKey);
							}

							callback({vertices: vertices, public_key: keypair.publicKey});
							return;
					})

				}
			})
		},

		decryptVertices: function(vertices, public_key) {

			for(i in vertices) {
				vertices[i].data = encryption.decryptObject(vertices[i].data, public_key);
			}

			return vertices;
		}
	};

	return graph;
};
