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
			}
		}
	};

	return database;
};
