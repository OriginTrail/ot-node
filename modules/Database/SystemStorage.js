const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SystemStorage {
    /**
     * Creates connection with SQLite system database located in ./system.db file
     * @returns {Promise<any>}
     */
    static connect() {
        return new Promise((resolve, reject) => {
            var db_connection = new sqlite3.Database(path.join(__dirname, 'system.db'), (err) => {
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
    /**
   * Runs update query on SQLite ot_system database
   * @param {string} update - SQLite database query
   * @param {object} params - Query parameters
   * @returns {Promise<any>}
   */
    static runSystemUpdate(update, params) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to database'));
            } else {
                this.db.run(update, params, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }
        });
    }
}

module.exports = SystemStorage;

