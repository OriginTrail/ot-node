// External modules
const config = require('./config');
const ipaddr = require('ipaddr.js');
const sha3 = require('solidity-sha3').default;
// eslint-disable-next-line no-unused-vars
const net = require('net');
// eslint-disable-next-line no-unused-vars
const natpmp = require('nat-pmp');
const _ = require('lodash');
const log = require('winston');

log.add(log.transports.File, { filename: 'log.log', colorize: true, prettyPrint: true });
log.remove(log.transports.Console);
log.add(log.transports.Console, { colorize: true });

module.exports = function () {
    const utilities = {


        executeCallback: function executeCallback(callback, callback_input) {
            if (typeof callback === 'function') {
                callback(callback_input);
            } else {
                log.info('Callback not defined!');
            }
        },

        getConfig() {
            return config;
        },

        isEmptyObject(test_object) {
            return Object.keys(test_object).length === 0 && test_object.constructor === Object;
        },

        getRandomInt(max) {
            return _.random(0, max);
        },

        sha3(value) {
            return sha3(value);
        },

        isIpEqual(ip1, ip2) {
            const ip1v4 = ipaddr.process(ip1).octets.join('.');
            const ip2v4 = ipaddr.process(ip2).octets.join('.');
            return ip1v4 == ip2v4;
        },

        copyObject(Obj) {
            return JSON.parse(JSON.stringify(Obj));
        },

        sortObject(object) {
            let sortedObj = {},
                keys = Object.keys(object);

            keys.sort((key1, key2) => {
                key1 = key1.toLowerCase(), key2 = key2.toLowerCase();
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
        },

        getRandomIntRange(min, max) {
            return _.random(min, max);
        },

        getLogger() {
            return log;
        },
    };

    return utilities;
};
