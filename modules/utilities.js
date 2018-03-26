// External modules
const config = require('./config');
const ipaddr = require('ipaddr.js');
const sha3 = require('solidity-sha3').default;
const _ = require('lodash');
const logger = require('winston');
const randomString = require('randomstring');

class Utilities {
    static executeCallback(callback, callback_input) {
        if (typeof callback === 'function') {
            callback(callback_input);
        } else {
            const log = this.getLogger();
            log.info('Callback not defined!');
        }
    }

    static getConfig() {
        return config;
    }

    /**
    * Checks if an object is empty
    *
    * @param test_object
    * @return {boolean}
    */
    static isEmptyObject(test_object) {
        return Object.keys(test_object).length === 0 && test_object.constructor === Object;
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
    * Makes a SHA3 encryption of value
    *
    * @param value
    * @return {*}
    */
    static sha3(value) {
        return sha3(value);
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
    * Makes a copy of object
    *
    * @param object Obj
    * @return object
    */
    static copyObject(Obj) {
        return JSON.parse(JSON.stringify(Obj));
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
    * Converts kebab-case to snakeCase
    *
    * @param text
    * @return string text
    */
    static toSnakeCase(text) {
        return text.replace(/-([a-z])/g, g => g[1].toUpperCase());
    }

    /**
    * Returns an instance of winston logger
    *
    * @return object log
    */
    static getLogger() {
        try {
            logger.add(logger.transports.File, { filename: 'log.log', colorize: true, prettyPrint: true });
            logger.remove(logger.transports.Console);
            logger.add(logger.transports.Console, { colorize: true });
        } catch (e) {
            //
        }
        return logger;
    }

    static getRandomString(howLong) {
        return randomString.generate({
            length: howLong,
            charset: 'alphabetic',
        });
    }
}

module.exports = Utilities;

