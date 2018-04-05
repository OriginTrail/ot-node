const SystemStorage = require('./Database/systemStorage');
const soliditySha3 = require('solidity-sha3').default;
var logger = require('winston');

class Utilities {
    constructor() {
        try {
            logger.add(logger.transports.File, { filename: 'log.log', colorize: true, prettyPrint: true });
            logger.remove(logger.transports.Console);
            logger.add(logger.transports.Console, { colorize: true });
        } catch (e) {
            console.log(e);
        }
    }

    /**
     * Get configuration parameters from SystemStorage database, table node_config
     * @returns {Promise<void>}
     */
    static loadConfig() {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery('SELECT * FROM node_config', []).then((rows) => {
                    [this.config] = rows;
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
     * Returns winston logger
     * @returns {*} - log function
     */
    static getLogger() {
        return logger;
    }

    /**
     * Get information of selected graph storage database
     * @returns {Promise<any>}
     */
    static loadSelectedDatabaseInfo() {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery('SELECT gd.* FROM node_config AS nc JOIN graph_database gd ON nc.selected_graph_database = gd.id', []).then((rows) => {
                    [this.selectedDatabase] = rows;
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
    static loadSelectedBlockchainInfo() {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery('SELECT bd.* FROM node_config AS nc JOIN blockchain_data bd ON nc.selected_blockchain = bd.id', []).then((rows) => {
                    [this.selectedDatabase] = rows;
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
     * Returns solidity keccak256 hash of given data
     * @param data
     * @returns {string}
     */
    static sha3(data) {
        return soliditySha3(data);
    }

    /**
     * Checks if an object is empty
     * @param obj        Object to be checked
     * @return {boolean} Is empty or not
     */
    static isEmptyObject(obj) {
        return Object.keys(obj).length === 0 && obj.constructor === Object;
    }

    /**
     * Tries to execute callback if there is one
     * @param callback        Callback to be executed
     * @param callback_input  Callback inputs
     */
    static executeCallback(callback, callback_input) {
        if (typeof callback === 'function') {
            callback(callback_input);
        } else {
            const log = this.getLogger();
            log.info('Callback not defined!');
        }
    }
}

module.exports = Utilities;
