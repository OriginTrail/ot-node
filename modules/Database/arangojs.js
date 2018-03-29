const { Database } = require('arangojs');
const IGNORE_DOUBLE_INSERT = true;

class ArangoJS {
    /**
     * Creates new object connected with ArangoDB database,
     * with connection data found in system database
     * @constructor
     * @param username
     * @param password
     * @param database
     * @param host
     * @param port
     */
    constructor(username, password, database, host, port) {
        this.db = new Database(`http://${host}:${port}`);
        this.db.useDatabase(database);
        this.db.useBasicAuth(username, password);
    }

    /**
     * Run query on ArangoDB graph database
     * @param {string} -queryString
     * @param {object} -params
     * @returns {Promise<any>}
     */
    runQuery(queryString, params) {
        return new Promise((resolve, reject) => {
            try {
                this.db.query(queryString, params).then((cursor) => {
                    resolve(cursor.all());
                }).catch((err) => {
                    console.log(err);
                    reject(err);
                });
            } catch (err) {
                console.log(err);
                reject(err);
            }
        });
    }

    /**
     * Inserts document into ArangoDB graph Database for given collectio name
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    addDocument(collectionName, document) {
        return new Promise((resolve, reject) => {
            const collection = this.db.collection(collectionName);
            collection.save(document).then(
                meta => resolve(meta),
                (err) => {
                    const errorCode = err.response.body.code;
                    if (IGNORE_DOUBLE_INSERT) {
                        resolve('Double insert');
                    } else {
                        reject(err);
                    }
                },
            ).catch((err) => {
                reject(err);
            });
        });
    }
}

module.exports = ArangoJS;
