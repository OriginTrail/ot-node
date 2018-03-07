// External modules
const utilities = require('./utilities')();
const Database = require('arangojs').Database;
const config = utilities.getConfig();

const username = config.DB_USERNAME;
const password = config.DB_PASSWORD;
// const host = config.DB_HOST;
// const port = config.DB_PORT;
const database = config.DB_DATABASE;

const db = new Database();
db.useDatabase(database);
db.useBasicAuth(username, password);

module.exports = function () {
	let database = {
		getConnection: function () {
			return db;
		},

		runQuery: async function (queryString, callback, params = {}) {
			try {
				let cursor = await db.query(queryString, params);
				utilities.executeCallback(callback, cursor._result);
			} catch (err) {
				utilities.executeCallback(callback, []);
				console.log(err);
			}
		},
		createVertexCollection: async function(collection_name, callback) {
			var collection = db.collection(collection_name);
			collection.create().then(
			  () => {
			  		console.log('Collection created');
			  		utilities.executeCallback(callback, true);
				},
			  err => {
			  	if(err.response.body.code == 409) {
			  		console.log('collection already exists');
			  		utilities.executeCallback(callback, true);
			  	}
			  	else
			  		{
			  		console.log(err);
				  	utilities.executeCallback(callback, false);
				  	}
			  	}
			);	
		},
		createEdgeCollection: async function(collection_name, callback) {
			var collection = db.edgeCollection(collection_name);
			collection.create().then(
			  () => {
			  		console.log('Collection created');
			  		utilities.executeCallback(callback, true);
				},
			  err => {
			  	if(err.response.body.code == 409) {
			  		console.log('collection already exists');
			  		utilities.executeCallback(callback, true);
			  	}
			  	else
			  		{
			  		console.log(err);
				  	utilities.executeCallback(callback, false);
				  	}
			  	}
			);
		},

		addVertex: function(collection_name, vertex, callback) {
			var collection = db.collection(collection_name);
			collection.save(vertex).then(
			  meta => utilities.executeCallback(callback, true),
			  err => {
			  	//console.error('Failed to save document:', err)
			  	utilities.executeCallback(callback, false);
			  }
			);
		},

		addEdge: function(collection_name, edge, callback) {
			var collection = db.collection(collection_name);
			collection.save(edge).then(
			  meta => utilities.executeCallback(callback, true),
			  err => {
			  	//console.error('Failed to save document:', err)
			  	utilities.executeCallback(callback, false);
			  }
			);
		},

		updateDocumentImports: function(collection_name, document_key, import_number, callback) {
			var collection = db.collection(collection_name);
			collection.document(document_key).then(
			  doc => {

					var imports = doc.imports;
			  	
					if(imports == undefined)
			  		imports = [];

			  	if(imports.indexOf(import_number) == -1)
			  	{
						imports.push(import_number);
						collection.update(document_key, {imports: imports}).then(
					  meta => utilities.executeCallback(callback, true),
					  err => {
					  	console.log(err);
					  	utilities.executeCallback(callback, false);
							}
						);  		
			  	}
			  },
			  err => {
			  	console.log(err)
			  	utilities.executeCallback(callback, false)
              }
			);			
		},
		
		getVerticesByImportId: async function(import_id, callback){

			queryString = 'FOR v IN ot_vertices FILTER POSITION(v.imports, @importId, false) != false RETURN v';
			params = {importId: import_id};

			try {
				let cursor = await db.query(queryString, params);
				utilities.executeCallback(callback, cursor._result);
			} catch (err) {
				utilities.executeCallback(callback, []);
				console.log(err);
			}
		},

		getEdgesByImportId: async function(import_id, callback){

			queryString = 'FOR v IN ot_edges FILTER POSITION(v.imports, @importId, false) != false RETURN v';
			params = {importId: import_id};

			try {
				let cursor = await db.query(queryString, params);
				utilities.executeCallback(callback, cursor._result);
			} catch (err) {
				utilities.executeCallback(callback, []);
				console.log(err);
			}
		}
	};

	return database;
};
