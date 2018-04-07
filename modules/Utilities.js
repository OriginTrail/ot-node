const SystemStorage = require('./Database/SystemStorage');
const soliditySha3 = require('solidity-sha3').default;
const Sequelize = require('sequelize');
const pem = require('pem');
const fs = require('fs');
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
            new SystemStorage().connect().then(db => {

                const Config = db.define('node_config', {
                    node_wallet: {
                        type: Sequelize.STRING,
                    },
                }, {
                    tableName: 'node_config',
                });
                Config.findOne().then(config => {
                    console.log(config);
                });
            });

            // db.connect().then(() => {
            //     db.runSystemQuery('SELECT * FROM node_config', []).then((rows) => {
            //         [this.config] = rows;
            //         rows[0].ssl_authority_paths = JSON.parse(rows[0].ssl_authority_paths);
            //         rows[0].network_bootstrap_nodes = JSON.parse(rows[0].network_bootstrap_nodes);
            //         resolve(rows[0]);
            //     }).catch((err) => {
            //         reject(err);
            //     });
            // }).catch((err) => {
            //     reject(err);
            // });
        });
    }

    static saveToConfig(property, value) {
        return new Promise((resolve, reject) => {
            const db = new SystemStorage();
            db.connect().then(() => {
                db.runSystemQuery(`UPDATE node_config SET ${property}='${value}' WHERE ID = 1`, []).then((rows) => {
                    resolve(rows);
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
        try {
            logger.add(logger.transports.File, { filename: 'log.log', colorize: true, prettyPrint: true });
            logger.remove(logger.transports.Console);
            logger.add(logger.transports.Console, { colorize: true });
        } catch (e) {
            // console.log(e);
        }
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

    static getSelectedDatabaseInfo() {
        if (!this.config) {
            throw Error('Configuration not loaded from system database');
        } else {
            return this.config;
        }
    }

    /**
    * Generate Self Signed SSL for Kademlia
    * @return {Promise<any>}
    * @private
    */
    static generateSelfSignedCertificate(config) {
        return new Promise((resolve, reject) => {
            pem.createCertificate({
                days: 365,
                selfSigned: true,
            }, (err, keys) => {
                if (err) {
                    return reject(err);
                }
                fs.writeFileSync(`${__dirname}/../keys/${config.ssl_key_path}`, keys.serviceKey);
                fs.writeFileSync(`${__dirname}/../keys/${config.ssl_certificate_path}`, keys.certificate);
                return resolve();
            });
        });
    }

    /**
    * Generates private extended key for identity
    * @param config
    * @param kadence
    */
    static createPrivateExtendedKey(config, kadence) {
        if (!fs.existsSync(`${__dirname}/../keys/${config.private_extended_key_path}`)) {
            fs.writeFileSync(
                `${__dirname}/../keys/${config.private_extended_key_path}`,
                kadence.utils.toHDKeyFromSeed().privateExtendedKey,
            );
        }
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
}

module.exports = Utilities;
