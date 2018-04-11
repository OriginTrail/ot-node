// eslint-disable-next-line import/no-unresolved
const utilities = require('../../utilities');
const Web3 = require('web3');
// eslint-disable-next-line import/no-extraneous-dependencies
const util = require('ethereumjs-util');
// eslint-disable-next-line import/no-unresolved
const signing = require('./signing');

const EventEmitter = require('events');

const transaction_event = new EventEmitter();

const config = utilities.getConfig();
const log = utilities.getLogger();


const transaction_queue = [];
let transaction_pending = false;

module.exports = () => {
    function signalNextInQueue() {
        transaction_queue.shift();
        transaction_pending = false;
        if (transaction_queue.length > 0) {
            var next_transaction = String(transaction_queue[0]);
            transaction_event.emit(next_transaction);
        }
    }

    function readyFor(rawTx) {
        return new Promise((resolve) => {
            var tx_string = String(rawTx);
            transaction_event.on(tx_string, () => {
                resolve();
            });
        });
    }

    const tx_queue = {

        queueTransaction(rawTx, callback) {
            return new Promise((async (resolve, reject) => {
                transaction_queue.push(rawTx);
                if (transaction_pending) await readyFor(rawTx);
                transaction_pending = true;
                signing.sendRaw(rawTx)
                    .then((response) => {
                        log.info('Transaction: ', response);
                        signalNextInQueue();
                        if (response.status === '0x0') {
                            if (callback) utilities.executeCallback(callback, false);
                            reject(response);
                        } else {
                            if (callback) utilities.executeCallback(callback, response);
                            resolve(response);
                        }
                    })
                    .catch((err) => {
                        log.warn(err);
                        signalNextInQueue();
                        if (callback) utilities.executeCallback(callback, false);
                        reject(err);
                    });
            }));
        },
    };

    return tx_queue;
};
