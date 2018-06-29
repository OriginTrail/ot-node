const Tx = require('ethereumjs-tx');
const EventEmitter = require('events');
const { txutils } = require('eth-lightwallet');
const { Lock } = require('semaphore-async-await');

class Transactions {
    /**
     * Initialize Transaction object
     * @param web3 Instance of the Web object
     * @param wallet Blockchain wallet represented in hex string in 0x format
     * @param walletKey Wallet's private in Hex string without 0x at beginning
     */
    constructor(web3, wallet, walletKey) {
        this.web3 = web3;
        this.transactionEventEmmiter = new EventEmitter();
        this.privateKey = Buffer.from(walletKey, 'hex');
        this.walletAddress = wallet;
        this.lock = new Lock();
    }

    /**
     * Send transaction to Ethereum blockchain
     * @returns {PromiEvent<TransactionReceipt>}
     * @param newTransaction
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
}

module.exports = Transactions;
