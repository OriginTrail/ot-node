const sqlite3 = require('sqlite3').verbose();

class SystemStorage {
    /**
     * Creates connection with SQLite system database located in ./system.db file
     * @returns {Promise<any>}
     */
    static connect() {
        return new Promise((resolve, reject) => {
            var db_connection = new sqlite3.Database('./modules/Database/system.db', (err) => {
                if (err) {
                    reject(err.message);
                } else {
                    this.db = db_connection;
                    resolve(db_connection);
                }
            });
        });
    }

    /**
     * Runs query on SQLite ot_system database
     * @param {string} query - SQLite database query
     * @param {object} params - Query parameters
     * @returns {Promise<any>}
     */
    static runSystemQuery(query, params) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to database'));
            } else {
                this.db.all(query, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            }
        });
    }
}

module.exports = SystemStorage;

