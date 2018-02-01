// External modules
var utilities = require('./utilities')();
var Database = require('arangojs').Database;
var config = utilities.getConfig();

username = config.DB_USERNAME
password = config.DB_PASSWORD
host = config.DB_HOST
port = config.DB_PORT
database = config.DB_DATABASE

const db = new Database();
db.useDatabase(database);
db.useBasicAuth(username, password);

module.exports = function (){

	var database = {
		getConnection: function(){
			return db;
		},

		runQuery: async function(queryString, callback, params = {})
		{

			try {
			    cursor = await db.query(queryString, params);
			    utilities.executeCallback(callback, cursor._result);
			} catch(err)
			{
				utilities.executeCallback(callback, []);
			}
		}
	};

	return database;
}