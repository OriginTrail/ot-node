require('dotenv').config();

const soliditySha3 = require('solidity-sha3').default;
const pem = require('pem');
const fs = require('fs');
const ipaddr = require('ipaddr.js');
const _ = require('lodash');
const _u = require('underscore');
const randomString = require('randomstring');
const Web3 = require('web3');
const request = require('superagent');
const { Database } = require('arangojs');
const neo4j = require('neo4j-driver').v1;
const levenshtein = require('js-levenshtein');
const BN = require('bn.js');
const numberToBN = require('number-to-bn');
const sortedStringify = require('sorted-json-stringify');
const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');

const logger = require('./logger');
const { sha3_256 } = require('js-sha3');

class Utilities {
    /**
     * Creates new hash import ID.
     * @returns {*}
     */
    static createImportId(wallet) {
        return soliditySha3(Date.now().toString() + wallet);
    }

    /**
     * Saves value to configuration
     * @param property      Property name
     * @param val           Property value
     */
    static saveToConfig(config) {

    }

    /**
     * Custom sorted stringify
     * TODO think about optimization
     * @param obj - Object to be serialized
     * @param sortArrays - Sort array items
     * @return {string}
     */
    static sortedStringify(obj, sortArrays = false) {
        if (obj == null) {
            return 'null';
        }
        if (typeof obj === 'object') {
            const stringified = [];
            for (const key of Object.keys(obj)) {
                if (Array.isArray(obj)) {
                    stringified.push(this.sortedStringify(obj[key], sortArrays));
                } else {
                    stringified.push(`"${key}":${this.sortedStringify(obj[key], sortArrays)}`);
                }
                if (sortArrays) {
                    stringified.sort();
                }
            }
            if (!Array.isArray(obj)) {
                stringified.sort();
                return `{${stringified.join(',')}}`;
            }
            return `[${stringified.join(',')}]`;
        }
        return `${JSON.stringify(obj)}`;
    }

    /**
     * Optimized sort method for OTJSON 1.1
     * @param obj - Object to be serialized
     * @param inProperties - Sort array items except properties
     * @return {string}
     */
    static sortObjectRecursively(obj, inProperties = false) {
        if (obj != null && typeof obj === 'object') {
            const stringified = [];
            for (const key of Object.keys(obj)) {
                if (Array.isArray(obj)) {
                    if (obj[key] != null && typeof obj[key] === 'object') {
                        stringified.push(this.sortedStringify(obj[key], inProperties));
                    } else {
                        // Added for better performance by avoiding the last level of recursion
                        // because the last level only returns JSON.stringify of the key
                        stringified.push(JSON.stringify(obj[key]));
                    }
                } else if (obj[key] != null && typeof obj[key] === 'object') {
                    if (key === 'properties') { inProperties = true; }
                    stringified.push(`"${key}":${this.sortedStringify(obj[key], inProperties)}`);
                } else {
                    // Added for better performance by avoiding the last level of recursion
                    // because the last level only returns JSON.stringify of the key
                    stringified.push(`"${key}":${JSON.stringify(obj[key])}`);
                }
            }

            // Sort the object or sort the array if the sortArrays parameter is true
            if (!Array.isArray(obj) || inProperties === false) {
                stringified.sort();
            }

            // Return result in the format of a stringified array
            if (Array.isArray(obj)) {
                return `[${stringified.join(',')}]`;
            }
            // Return result in the format of an object
            return `{${stringified.join(',')}}`;
        }
        return JSON.stringify(obj);
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
                scopeList: process.env.NODE_ENV !== 'testnet' ?
                    ['dependencies', 'devDependencies'] : ['dependencies'],
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
     * Check if origintrail database exists, in case of arangoDB create one
     * @returns {Promise<any>}
     */
    static checkDoesStorageDbExists(config) {
        return new Promise((resolve, reject) => {
            switch (config.database.provider) {
            case 'arangodb': {
                const systemDb = new Database();
                systemDb.useBasicAuth(config.database.username, config.database.password);
                systemDb.listDatabases().then((result) => {
                    let databaseAlreadyExists = false;
                    for (let i = 0; i < result.length; i += 1) {
                        if (result[i].toString() === config.database.database) {
                            databaseAlreadyExists = true;
                        }
                    }
                    if (!databaseAlreadyExists) {
                        systemDb.createDatabase(
                            config.database.database,
                            [{
                                username: config.database.username,
                                passwd: config.database.password,
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
                    console.log('Please make sure Arango server is up and running');
                    reject(error);
                });
            }
                break;
            case 'neo4j':
                try {
                    // TODO
                    const host = process.env.NEO_HOST;
                    const port = process.env.NEO_PORT;
                    const user = process.env.NEO_USERNAME;
                    const pass = process.env.NEO_PASSWORD;
                    const driver = neo4j.driver(`bolt://${host}:${port}`, neo4j.auth.basic(user, 'nijePASS'));
                    const session = driver.session();
                    const a = session.run('match (n) return n');
                    session.close();
                    driver.close();
                    resolve();
                } catch (error) {
                    reject(error);
                }
                break;
            default:
                logger.error(config.database.provider);
                reject(Error('Database doesn\'t exists'));
            }
        });
    }

    /**
     * Generate Self Signed SSL for Kademlia
     * @return {Promise<any>}
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
                fs.writeFileSync(
                    path.join(config.appDataPath, config.ssl_keypath),
                    keys.serviceKey,
                );
                fs.writeFileSync(
                    path.join(config.appDataPath, config.ssl_certificate_path),
                    keys.certificate,
                );
                return resolve(true);
            });
        });
    }

    /**
     * Returns solidity keccak256 hash of given data
     * @param data
     * @returns {string}
     */
    static soliditySHA3(data) {
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
     * Get wallet's balance in Ether
     * @param web3 Instance of Web3
     * @param wallet Address of the wallet.
     * @returns {Promise<string |  | Object>}
     */
    static async getBalanceInEthers(web3, wallet) {
        const result = await web3.eth.getBalance(wallet);
        return web3.utils.fromWei(result, 'ether');
    }

    /**
     * Get wallet's TRAC token balance in Ether
     * @param web3 Instance of Web3
     * @param wallet Address of the wallet.
     * @param tokenContractAddress Contract address.
     * @param humanReadable format result in floating point TRAC value or not i.e. 0.3.
     * @returns {Promise<string |  | Object>}
     */
    static async getTracTokenBalance(web3, wallet, tokenContractAddress, humanReadable = true) {
        const walletDenormalized = this.denormalizeHex(wallet);
        // '0x70a08231' is the contract 'balanceOf()' ERC20 token function in hex.
        const contractData = (`0x70a08231000000000000000000000000${walletDenormalized}`);
        const result = await web3.eth.call({
            to: this.normalizeHex(tokenContractAddress),
            data: contractData,
        });
        const tokensInWei = web3.utils.toBN(result).toString();
        if (humanReadable) {
            return web3.utils.fromWei(tokensInWei, 'ether');
        }

        return tokensInWei;
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
            logger.info('Callback not defined!');
        }
    }

    /**
     * Sorts an object
     *
     * @param object
     * @return object
     */
    static sortObject(object) {
        if (typeof object !== 'object' || object == null) {
            return object;
        }
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
            if (typeof object[key] === 'object' &&
                !(object[key] instanceof Array) &&
                !(object[key] instanceof BN)) {
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
        // try {
        //     if (!fs.existsSync(`${__dirname}/../keys`)) {
        //         fs.mkdirSync(`${__dirname}/../keys`);
        //     }
        // } catch (error) {
        //     log.warn('Failed to create folder named keys');
        // }
        //
        // try {
        //     if (!fs.existsSync(`${__dirname}/../data`)) {
        //         fs.mkdirSync(`${__dirname}/../data`);
        //     }
        // } catch (error) {
        //     log.warn('Failed to create folder named data');
        // }
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

    static getArangoDbVersion({ database }) {
        return new Promise((resolve, reject) => {
            request
                .get(`http://${database.host}:${database.port}/_api/version`)
                .auth(database.username, database.password)
                .then((res) => {
                    if (res.status === 200) {
                        resolve(res.body);
                    } else {
                        // eslint-disable-next-line prefer-promise-reject-errors
                        reject('Failed to contact DB');
                    }
                }).catch((err) => {
                    reject(err);
                });
        });
    }

    /**
     * Gets block number from web3
     * @returns {Promise<any>}
     */
    static getBlockNumberFromWeb3(web3) {
        return new Promise((resolve, reject) => {
            web3.eth.getBlockNumber()
                .then((result) => {
                    resolve(web3.utils.hexToNumber(result));
                }).catch((error) => {
                    logger.error(error);
                    reject(error);
                });
        });
    }

    /**
     * Web3 Hex to number
     * @param hex
     * @returns {number}
     */
    static hexToNumber(hex) {
        if (!hex) {
            return hex;
        }

        return Utilities.toBN(hex).toNumber();
    }

    /**
     * Takes an input and transforms it into an BN
     * @param number
     * @returns {Object}
     */
    static toBN(number) {
        try {
            /* eslint-disable prefer-rest-params */
            return numberToBN(...arguments);
        } catch (e) {
            throw new Error(`${e} Given value: "${number}"`);
        }
    }

    /**
     * Web3 Number to hex
     * @param num
     * @returns {string}
     */
    static numberToHex(num) {
        if (_u.isNull(num) || _u.isUndefined(num)) {
            return num;
        }
        // eslint-disable-next-line no-restricted-globals
        if (!isFinite(num) && !Utilities.isHexStrict(num)) {
            throw new Error(`Given input "${num}" is not a number.`);
        }

        const number = Utilities.toBN(num);
        const result = number.toString(16);

        return number.lt(new BN(0)) ? `-0x${result.substr(1)}` : `0x${result}`;
    }


    /**
     * Check if string is HEX, requires a 0x in front
     * @param hex
     * @returns {*|boolean}
     */
    static isHexStrict(hex) {
        return ((_u.isString(hex) || _u.isNumber(hex)) && /^(-)?0x[0-9a-f]*$/i.test(hex));
    }

    /**
     * Merge array of objects
     * @param objects   Objects to be merges
     */
    static mergeObjects(objects) {
        const out = {};

        for (let i = 0; i < objects.length; i += 1) {
            for (const p in objects[i]) {
                out[p] = objects[i][p];
            }
        }
        return out;
    }

    /**
     * Flattens object
     * @param obj
     * @param name
     * @param stem
     */
    static flattenObject(obj, name, stem) {
        if (obj == null) {
            return obj;
        }
        let out = {};
        const newStem = (typeof stem !== 'undefined' && stem !== '') ? `${stem}_${name}` : name;

        if (typeof obj !== 'object') {
            out[newStem] = obj;
            return out;
        }

        for (const p in obj) {
            const prop = Utilities.flattenObject(obj[p], p, newStem);
            out = Utilities.mergeObjects([out, prop]);
        }
        return out;
    }

    /**
     * Finds the distance between two objects
     * Note: flatten-sort-compare by keys
     * @param obj1
     * @param obj2
     * @param excludedKeys
     */
    static objectDistance(obj1, obj2, excludedKeys = []) {
        const copyObj1 = Utilities.copyObject(obj1);
        const copyObj2 = Utilities.copyObject(obj2);

        for (const key of excludedKeys) {
            delete copyObj1[key];
            delete copyObj2[key];
        }

        const normalizedObj1 = Utilities.sortObject(Utilities.flattenObject(copyObj1));
        const normalizedObj2 = Utilities.sortObject(Utilities.flattenObject(copyObj2));

        const keys = Utilities.unionArrays(
            Object.keys(normalizedObj1),
            Object.keys(normalizedObj2),
        );

        let sum = 0;
        for (const key of keys) {
            const value1 = normalizedObj1[key];
            const value2 = normalizedObj2[key];

            if (value1 == null || value2 == null) {
                // eslint-disable-next-line
                continue;
            }

            const valStr1 = `${value1}`;
            const valStr2 = `${value2}`;

            if (valStr1 === valStr2) {
                sum += 1;
            } else {
                const maxLength = Math.max(valStr1.length, valStr2.length);
                sum += (maxLength - levenshtein(`${value1}`, `${value2}`)) / maxLength;
            }
        }

        const minKeysLength = Math.min(
            Object.keys(normalizedObj1).length,
            Object.keys(normalizedObj2).length,
        );
        return (sum * 100) / minKeysLength;
    }

    /**
     * Unify two arrays
     * @param x
     * @param y
     * @return {Array}
     */
    static unionArrays(x, y) {
        const obj = {};
        for (let i = x.length - 1; i >= 0; i -= 1) { obj[x[i]] = x[i]; }
        for (let i = y.length - 1; i >= 0; i -= 1) { obj[y[i]] = y[i]; }
        const res = [];
        for (const k in obj) {
            if (obj[k] !== null) {
                res.push(obj[k]);
            }
        }
        return res;
    }

    /**
     * Calculates import distance from my node
     * @param config Configuration
     * @param price Token amount to offer
     * @param importId ID
     * @param stakeAmount Stake amount in offer.
     * @returns {number} Distance
     */
    static getImportDistance(config, price, importId, stakeAmount) {
        const wallet = new BN(config.node_wallet);
        const nodeId = new BN(`0x${config.identity}`);
        const hashWallerNodeId = new BN(Utilities.soliditySHA3(wallet + nodeId));
        const myBid = hashWallerNodeId.add(price);
        const offer = new BN(Utilities.soliditySHA3(importId)).add(stakeAmount);
        return Math.abs(myBid.sub(offer));
    }

    static generateRsvSignature(message, web3, privateKey) {
        let sortedMessage;
        if (typeof message === 'string' || message instanceof String) {
            sortedMessage = message;
        } else {
            sortedMessage = JSON.stringify(Utilities.sortObject(message));
        }
        const signature = web3.eth.accounts.sign(
            sortedMessage,
            privateKey.toLowerCase().startsWith('0x') ?
                privateKey : `0x${privateKey}`,
        );

        return { r: signature.r, s: signature.s, v: signature.v };
    }

    static isMessageSigned(web3, message, signature) {
        let sortedMessage;
        if (typeof message === 'string' || message instanceof String) {
            sortedMessage = message;
        } else {
            sortedMessage = JSON.stringify(message);
        }
        const signedAddress = web3.eth.accounts.recover(
            sortedMessage,
            signature.v,
            signature.r,
            signature.s,
        );

        // todo remove this patch in the next release
        if (!Utilities.compareHexStrings(signedAddress, message.wallet)) {
            const sortedMessage = Utilities.sortObject(message);
            const signedAddress = web3.eth.accounts.recover(
                JSON.stringify(sortedMessage),
                signature.v,
                signature.r,
                signature.s,
            );
            return Utilities.compareHexStrings(signedAddress, message.wallet);
        }
        return true;
    }

    /**
     * Normalizes hex number
     * @param number     Hex number
     * @returns {string|null} Normalized hex number
     */
    static normalizeHex(number) {
        if (number == null) {
            return null;
        }
        number = number.toLowerCase();
        if (!number.startsWith('0x')) {
            return `0x${number}`;
        }
        return number;
    }

    /**
     * Calculate SHA3 from input objects and return normalized hex string.
     * @param rest An array of input data concatenated before calculating the hash.
     * @return {string} Normalized hash string.
     * @private
     */
    static keyFrom(...rest) {
        return Utilities.normalizeHex(sha3_256([...rest].reduce(
            (acc, argument) => {
                acc += Utilities.stringify(argument, 0);
                return acc;
            },
            '',
        )));
    }

    /**
     * Denormalizes hex number
     * @param number     Hex number
     * @returns {string|null} Normalized hex number
     */
    static denormalizeHex(number) {
        if (number == null) {
            return null;
        }
        number = number.toLowerCase();
        if (number.startsWith('0x')) {
            return number.substring(2);
        }
        return number;
    }

    /**
     * Compare HEX numbers in string representation
     * @param hex1
     * @param hex2
     * @return {*}
     */
    static compareHexStrings(hex1, hex2) {
        const denormalized1 = Utilities.denormalizeHex(hex1);
        const denormalized2 = Utilities.denormalizeHex(hex2);
        return new BN(denormalized1, 16).eq(new BN(denormalized2, 16));
    }

    /**
     * Expands hex number to desired number of digits.
     *
     * For example expandHex('3', 4) or expandHex('0x3', 4) will return '0003'
     * @param number
     * @param digitCount
     */
    static expandHex(number, digitCount) {
        const hex = this.denormalizeHex(number);

        if (hex.length > digitCount) {
            throw Error(`Number ${number} has more digits than required.`);
        }

        return new Array(digitCount - hex.length).join('0') + hex;
    }

    /**
     * Validates number property type
     * @param property
     * @returns {boolean}
     */
    static validateNumberParameter(property) {
        return property == null || parseInt(property, 10) > 0;
    }

    /**
     * Validates number property type and allows zero
     * @param property
     * @returns {boolean}
     */
    static validateNumberParameterAllowZero(property) {
        return property == null || parseInt(property, 10) >= 0;
    }

    /**
     * Validates string property type
     * @param property
     * @returns {boolean}
     */
    static validateStringParameter(property) {
        return property == null || typeof property === 'string';
    }

    /**
     * Converts minutes to milliseconds
     * @param minutes
     * @returns {*}
     */
    static convertToMilliseconds(minutes) {
        if (BN.isBN(minutes)) {
            return minutes.mul(new BN(60000));
        }
        return new BN(minutes).mul(new BN(60000));
    }

    /**
     * Converts milliseconds to minutes
     * @param milliseconds
     * @returns {BN}
     */
    static convertToMinuntes(milliseconds) {
        if (BN.isBN(milliseconds)) {
            return milliseconds.div(new BN(60000));
        }
        return new BN(milliseconds).div(new BN(60000));
    }

    /**
     * Shuffles array in place
     * @param {Array} a items An array containing the items.
     */
    static shuffle(a) {
        for (let i = a.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /**
     * Read file contents
     * @param file
     * @returns {Promise}
     */
    static fileContents(file) {
        return new Promise((resolve, reject) => {
            fs.readFile(file, 'utf8', (err, content) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(content);
                }
            });
        });
    }

    /**
     * Write contents to file
     * @param directory
     * @param filename
     * @param data
     * @returns {Promise}
     */
    static writeContentsToFile(directory, filename, data) {
        return new Promise((resolve, reject) => {
            mkdirp(directory, (err) => {
                if (err) {
                    reject(err);
                } else {
                    const fullpath = path.join(directory, filename);

                    fs.writeFile(fullpath, data, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }

    /**
     * Deletes directory recursively
     * @param directoryPath
     * @return {Promise}
     */
    static deleteDirectory(directoryPath) {
        return new Promise((resolve) => {
            rimraf(directoryPath, () => {
                resolve();
            });
        });
    }

    /**
     * Stringifies data to JSON with default parameters
     * @param data  Data to be stringified
     * @param ident JSON identification
     * @returns {*}
     */
    static stringify(data, ident = 2) {
        return sortedStringify(data, null, ident);
    }

    /**
     * Checks if hash is zero or any given hex string regardless of prefix 0x
     * @param {string} hash
     */
    static isZeroHash(hash) {
        const num = new BN(this.denormalizeHex(hash));

        return num.eqn(0);
    }

    /**
     * Strip values from config to be used for storing.
     * @param config Application config
     */
    static stripAppConfig(config) {
        const properties = [
            'node_wallet',
            'node_private_key',
            'node_port',
            'request_timeout',
            'cpus',
            'network',
            'node_rpc_port',
            'dh_min_stake_amount',
            'read_stake_factor',
            'control_port_enabled',
            'remote_control_enabled',
            'send_logs',
            'houston_password',
        ];

        const stripped = {};
        properties.forEach(prop => stripped[prop] = config[prop]);
        return stripped;
    }

    /**
     * Groups array by some criteria
     * @param list - Array of items
     * @param keyGetter - Group criteria
     * @return {Map<any, any>}
     */
    static groupBy(list, keyGetter) {
        const map = new Map();
        list.forEach((item) => {
            const key = keyGetter(item);
            const collection = map.get(key);
            if (!collection) {
                map.set(key, [item]);
            } else {
                collection.push(item);
            }
        });
        return map;
    }

    /**
     * Wrap into array if necessary
     * @return {*}
     */
    static arrayze(obj) {
        if (Array.isArray(obj)) {
            return obj;
        }
        return [obj];
    }
}

module.exports = Utilities;
