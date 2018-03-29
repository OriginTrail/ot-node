const SystemStorage = require('./Database/systemStorage');

class Utilities {

    /**
     * Get configuration parameters from SystemStorage database, table node_config
     * @returns {Promise<void>}
     */
    static getConfig() {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery('SELECT * FROM node_config', []).then((rows) => {
                    resolve(rows[0]);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Get information of selected graph storage database
     * @returns {Promise<any>}
     */
    static getSelectedDatabaseInfo() {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery('SELECT gd.* FROM node_config AS nc JOIN graph_database gd ON nc.selected_graph_database = gd.id', []).then((rows) => {
                    resolve(rows[0]);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }
}

module.exports = Utilities;