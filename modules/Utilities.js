const soliditySha3 = require('solidity-sha3').default;
const pem = require('pem');
const fs = require('fs');
const ipaddr = require('ipaddr.js');
var winston = require('winston');
const deasync = require('deasync-promise');
const Storage = require('./Storage');
const config = require('./Config');
const _ = require('lodash');
const randomString = require('randomstring');
const Web3 = require('web3');
const request = require('superagent');
// eslint-disable-next-line  prefer-destructuring
const Database = require('arangojs').Database;
require('dotenv').config();


class Utilities {
    constructor() {
        this.getLogger();
    }

    /**
     * Get configuration parameters from SystemStorage database, table node_config
     * @returns {Promise<void>}
     */
    static loadConfig() {
        return new Promise((resolve, reject) => {
            Storage.models.node_config.findAll({
                attributes: ['key', 'value'],
            }).then((cnfs) => {
                cnfs.forEach((cnf) => {
                    const prop = cnf.get({
                        plain: true,
                    }).key;
                    if (prop === 'network_bootstrap_nodes' || prop === 'ssl_authority_paths' || prop === 'remote_access_whitelist') {
                        config[cnf.get({
                            plain: true,
                        }).key] = JSON.parse(cnf.get({
                            plain: true,
                        }).value);
                    } else {
                        config[cnf.get({
                            plain: true,
                        }).key] = cnf.get({
                            plain: true,
                        }).value;
                    }
                });
                resolve(config);
            });
        });
    }

    /**
     * Saves value to configuration
     * @param property      Property name
     * @param val           Property value
     */
    static saveToConfig(property, val) {
        return new Promise((resolve, reject) => {
            Storage.models.node_config.find({
                where: { key: property },
            }).then((row) => {
                row.value = val;
                return row.save();
            }).then(() => Utilities.loadConfig())
                .then(() => {
                    resolve();
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    /**
     * Check if all dependencies from package.json are installed
     * @returns {Promise<any>} containing error array:
     *   error: []            // when everything is OK, error array is empty
     *   error: array,        // if not OK, array of logged errors is returned
     */
    static checkInstalledDependencies() {
        return new Promise((resolve, reject) => {
            // eslint-disable-next-line global-require
            require('check-dependencies')({
                packageManager: 'npm',
                // eslint-disable-next-line no-template-curly-in-string
                packageDir: '${__dirname}/../',
                install: false,
                scopeList: ['dependencies', 'devDependencies'],
                verbose: false,
            }).then((output) => {
                if (!output.depsWereOk) {
                    reject(output.error);
                }
                resolve(output.error);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * Returns winston logger
     * @returns {*} - log function
     */
    static getLogger() {
        var logLevel = 'trace';

        var customColors = {
            trace: 'grey',
            notify: 'green',
            debug: 'blue',
            info: 'white',
            warn: 'yellow',
            important: 'magenta',
            error: 'red',
        };


        try {
            var logger = new (winston.Logger)({
                colors: customColors,
                level: logLevel,
                levels: {
                    error: 0,
                    important: 1,
                    warn: 2,
                    info: 3,
                    debug: 4,
                    notify: 5,
                    trace: 6,
                },
                transports: [
                    new (winston.transports.Console)({
                        colorize: 'all',
                        timestamp: false,
                    }),
                    new (winston.transports.File)({ filename: 'node.log' }),
                ],
            });
            winston.addColors(customColors);

            // Extend logger object to properly log 'Error' types
            var origLog = logger.log;

            logger.log = function (level, msg) {
                if (msg instanceof Error) {
                    // eslint-disable-next-line prefer-rest-params
                    var args = Array.prototype.slice.call(arguments);
                    args[1] = msg.stack;
                    origLog.apply(logger, args);
                } else {
                    // eslint-disable-next-line prefer-rest-params
                    origLog.apply(logger, arguments);
                }
            };
            return logger;
        } catch (e) {
            // console.log(e);
        }
    }

    /**
     * Get information of selected graph storage database
     * @returns {Promise<any>}
     */
    static loadSelectedDatabaseInfo() {
        return new Promise((resolve, reject) => {
            Storage.models.node_config.findOne({
                attributes: ['key', 'value'],
                where: { key: 'selected_graph_database' },
            }).then((id) => {
                const gDBid = id.get({ plain: true });
                Storage.models.graph_database.findById(gDBid.value)
                    .then((gdb) => {
                        resolve(gdb.get({ plain: true }));
                    });
            });
        });
    }

    /**
     * Check does origintrail database exists, otherwise create one
     * @returns {Promise<any>}
     */
    static checkDoesStorageDbExists() {
        return new Promise((resolve, reject) => {
            const systemDb = new Database();
            systemDb.useBasicAuth(process.env.DB_USERNAME, process.env.DB_PASSWORD);
            systemDb.listDatabases().then((result) => {
                let databaseAlreadyExists = false;
                for (let i = 0; i < result.length; i += 1) {
                    if (result[i].toString() === process.env.DB_DATABASE) {
                        databaseAlreadyExists = true;
                    }
                }
                if (!databaseAlreadyExists) {
                    systemDb.createDatabase(
                        process.env.DB_DATABASE,
                        [{
                            username: process.env.DB_USERNAME,
                            passwd: process.env.DB_PASSWORD,
                            active: true,
                        }],
                    ).then((result) => {
                        resolve();
                    }).catch((error) => {
                        reject(error);
                    });
                }
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * Get information of selected graph storage database
     * @returns {Promise<any>}
     */
    static loadSelectedBlockchainInfo() {
        return new Promise((resolve, reject) => {
            Storage.models.node_config.findOne({
                attributes: ['key', 'value'],
                where: { key: 'selected_blockchain' },
            }).then((id) => {
                const BCid = id.get({ plain: true });
                Storage.models.blockchain_data.findById(BCid.value)
                    .then((bc) => {
                        resolve(bc.get({ plain: true }));
                    });
            });
        });
    }

    /**
    * Generate Self Signed SSL for Kademlia
    * @return {Promise<any>}
    * @private
    */
    static generateSelfSignedCertificate() {
        return new Promise((resolve, reject) => {
            pem.createCertificate({
                days: 365,
                selfSigned: true,
            }, (err, keys) => {
                if (err) {
                    return reject(err);
                }
                fs.writeFileSync(`${__dirname}/../keys/${config.ssl_keypath}`, keys.serviceKey);
                fs.writeFileSync(`${__dirname}/../keys/${config.ssl_certificate_path}`, keys.certificate);
                return resolve();
            });
        });
    }

    /**
    * Generates private extended key for identity
    * @param kadence
    */
    static createPrivateExtendedKey(kadence) {
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

    /**
     * Checks if two IPs are equal
     *
     * @param ip1
     * @param ip2
     * @return {boolean}
     */
    static isIpEqual(ip1, ip2) {
        const ip1v4 = ipaddr.process(ip1).octets.join('.');
        const ip2v4 = ipaddr.process(ip2).octets.join('.');
        return ip1v4 === ip2v4;
    }

    /**
     * Gets a random integer
     *
     * @param max
     * @return {number}
     */
    static getRandomInt(max) {
        return _.random(0, max);
    }

    /**
     * Gets a random integer in some specific range
     *
     * @param min
     * @param max
     * @return {number}
     */
    static getRandomIntRange(min, max) {
        return _.random(min, max);
    }

    /**
     * Get random string
     * @param howLong
     * @returns {void|*}
     */
    static getRandomString(howLong) {
        return randomString.generate({
            length: howLong,
            charset: 'alphabetic',
        });
    }

    /**
     * Makes a copy of object
     *
     * @param object Obj
     * @return object
     */
    static copyObject(Obj) {
        return JSON.parse(JSON.stringify(Obj));
    }

    /**
     * Execute callback
     * @param callback
     * @param callback_input
     */
    static executeCallback(callback, callback_input) {
        if (typeof callback === 'function') {
            callback(callback_input);
        } else {
            const log = this.getLogger();
            log.info('Callback not defined!');
        }
    }

    /**
     * Sorts an object
     *
     * @param object
     * @return object
     */
    static sortObject(object) {
        const sortedObj = {};
        const keys = Object.keys(object);

        keys.sort((key1, key2) => {
            // eslint-disable-next-line no-param-reassign
            key1 = key1.toLowerCase();
            // eslint-disable-next-line no-param-reassign
            key2 = key2.toLowerCase();
            if (key1 < key2) return -1;
            if (key1 > key2) return 1;
            return 0;
        });

        for (const index in keys) {
            const key = keys[index];
            if (typeof object[key] === 'object' && !(object[key] instanceof Array)) {
                sortedObj[key] = this.sortObject(object[key]);
            } else {
                sortedObj[key] = object[key];
            }
        }

        return sortedObj;
    }

    /**
     * Checks for expected ot-node directory structure
     * @returns {void}
     */
    static checkOtNodeDirStructure() {
        const log = this.getLogger();
        try {
            if (!fs.existsSync(`${__dirname}/../keys`)) {
                fs.mkdirSync(`${__dirname}/../keys`);
            }
        } catch (error) {
            log.warn('Failed to create folder named keys');
        }

        try {
            if (!fs.existsSync(`${__dirname}/../data`)) {
                fs.mkdirSync(`${__dirname}/../data`);
            }
        } catch (error) {
            log.warn('Failed to create folder named data');
        }
    }

    /**
     * Check on which network blockchain is running on
     * @returns {Promise<any>}
     */
    static getNodeNetworkType() {
        return new Promise((resolve, reject) => {
            this.loadSelectedBlockchainInfo().then((config) => {
                const web3 = new Web3(new Web3.providers.HttpProvider(`${config.rpc_node_host}:${config.rpc_node_port}`));
                web3.eth.net.getNetworkType()
                    .then((result) => {
                        resolve(result);
                    }).catch((error) => {
                        reject(error);
                    });
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * Pings infura rinkeby api methods endpoint
     * @returns {Promise<any>}
     */
    static getInfuraRinkebyApiMethods() {
        return new Promise((resolve, reject) => {
            request
                .get('https://api.infura.io/v1/jsonrpc/rinkeby/methods')
                .query('?token=1WRiEqAQ9l4SW6fGdiDt')
                .then((res) => {
                    resolve(res);
                }).catch((err) => {
                    reject(err);
                });
        });
    }

    /**
     * Pings infura rinkeby api eth_blockNumber method endpoint
     * @returns {Promise<any>}
     */
    static getBlockNumberInfuraRinkebyApiMethod() {
        return new Promise((resolve, reject) => {
            request
                .get('https://api.infura.io/v1/jsonrpc/rinkeby/eth_blockNumber')
                .query('?token=1WRiEqAQ9l4SW6fGdiDt')
                .then((res) => {
                    resolve(res);
                }).catch((err) => {
                    reject(err);
                });
        });
    }

    /**
     * Gets block number from web3
     * @returns {Promise<any>}
     */
    static getBlockNumberFromWeb3() {
        return new Promise((resolve, reject) => {
            this.loadSelectedBlockchainInfo().then((config) => {
                const web3 = new Web3(new Web3.providers.HttpProvider(`${config.rpc_node_host}:${config.rpc_node_port}`));
                web3.eth.getBlockNumber()
                    .then((result) => {
                        resolve(web3.utils.numberToHex(result));
                    }).catch((error) => {
                        reject(error);
                    });
            }).catch((error) => {
                reject(error);
            });
        });
    }
}

module.exports = Utilities;
