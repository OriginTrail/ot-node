const Tx = require('ethereumjs-tx');
const EventEmitter = require('events');
const config = require('../../Config');
const Lightwallet = require('eth-lightwallet');
const { Lock } = require('semaphore-async-await');

const { txutils } = Lightwallet;

class Transactions {
    /**
     * Initialize Transaction object
     * @param web3
     */
    constructor(web3) {
        this.web3 = web3;
        this.transactionQueue = [];
        this.transactionPending = false;
        this.transactionEventEmmiter = new EventEmitter();
        this.privateKey = Buffer.from(config.node_private_key, 'hex');
        this.walletAddress = config.node_wallet;
        this.lock = new Lock();
    }
    /**
     * Send transaction to Ethereum blockchain
     * @param {object} - rawTx
     * @param {string} - privateKey
     * @returns {PromiEvent<TransactionReceipt>}
     */
    async sendTransaction(newTransaction) {
        await this.web3.eth.getTransactionCount(this.walletAddress).then((nonce) => {
            newTransaction.options.nonce = nonce;
        });

        const rawTx = txutils.functionTx(
            newTransaction.contractAbi,
            newTransaction.method,
            newTransaction.args,
            newTransaction.options,
        );

        const transaction = new Tx(rawTx);
        transaction.sign(this.privateKey);

        const serializedTx = transaction.serialize().toString('hex');
        return this.web3.eth.sendSignedTransaction(`0x${serializedTx}`);
    }

    /**
     * Signal that queue is ready for next transaction
     */
    signalNextInQueue() {
        this.lock.release();
    }

    /**
     * Returns promise that would be resolved when transaction,
     * given as argument, is next in transaction queue
     * @param newTransaction
     * @returns {Promise<any>}
     */
    readyFor(newTransaction) {
        return new Promise((resolve) => {
            var txString = String(newTransaction);
            this.transactionEventEmmiter.on(txString, () => {
                resolve();
            });
        });
    }

    /**
     * Adding new transaction in transaction queue
     * @param contractAbi
     * @param method
     * @param args
     * @param options
     * @returns {Promise<any>}
     */
    queueTransaction(contractAbi, method, args, options) {
        return new Promise((async (resolve, reject) => {
            const newTransaction = {
                contractAbi, method, args, options,
            };

            await this.lock.acquire();

            this.sendTransaction(newTransaction)
                .then((response) => {
                    this.signalNextInQueue();
                    if (response.status === '0x0') {
                        reject(response);
                    } else {
                        resolve(response);
                    }
                })
                .catch((err) => {
                    // log.warn(err);
                    this.signalNextInQueue();
                    reject(err);
                });
        }));
    }

    /**
    * Get the value from getter
    * @param contract
    * @param functionName
    * @param functionParameters
    * @return {Promise<string>}
    */
    getValue(contract, functionName, functionParameters) {
        console.log(contract);
        var callData = contract.methods.cancelBid.call(0, (err, res) => {
            console.log(res);
        });
        // return this.web3.eth.call({
        //     to: this.walletAddress,
        //     data: callData,
        // });
    }
}

module.exports = Transactions;
