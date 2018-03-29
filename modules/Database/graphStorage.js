const Utilities = require('../utilities');
const ArangoJS = require('./arangojs.js');

class GraphStorage {
    /**
     * Connecting to graph database system selected in system database
     * @returns {Promise<any>}
     */
    connect() {
        return new Promise((resolve, reject) => {
            Utilities.getSelectedDatabaseInfo().then((database) => {
                switch (database.database_system) {
                case 'arango_db':
                    this.db = new ArangoJS(
                        database.username,
                        database.password,
                        database.database,
                        database.host,
                        database.port,
                    );
                    resolve(this.db);
                    break;
                default: reject(Error('Unsupported graph database system'));
                }
            }).catch((err) => {
                console.log(err);
                reject(err);
            });
        });
    }

    /**
     * Runs query on selected database
     * @param {string} - queryString - Query string
     * @param {object} - params - Query parameters
     * @returns {Promise<any>}
     */
    runQuery(queryString, params) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.runQuery(queryString, params).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Add new document into given collection on selected database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    addDocument(collectionName, document) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.addDocument(collectionName, document).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }
}

module.exports = GraphStorage;
