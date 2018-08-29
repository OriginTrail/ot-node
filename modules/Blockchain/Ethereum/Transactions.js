const Tx = require('ethereumjs-tx');
const { txutils } = require('eth-lightwallet');
const Queue = require('better-queue');
const sleep = require('sleep-async')().Promise;
const BN = require('bn.js');
const Utilities = require('../../Utilities.js');

class Transactions {
    /**
     * Initialize Transaction object
     * @param web3 Instance of the Web object
     * @param wallet Blockchain wallet represented in hex string in 0x format
     * @param walletKey Wallet's private in Hex string without 0x at beginning
     */
    constructor(web3, wallet, walletKey) {
        this.log = Utilities.getLogger();
        this.web3 = web3;
        this.privateKey = Buffer.from(walletKey, 'hex');
        this.walletAddress = wallet;
        this.lastTransactionTime = Date.now();

        this.queue = new Queue((async (args, cb) => {
            const { transaction, future } = args;
            try {
                for (let i = 0; i < 3; i += 1) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const result = await this._sendTransaction(transaction);
                        if (result.status === '0x0') {
                            future.reject(result);
                            break;
                        } else {
                            future.resolve(result);
                            break;
                        }
                    } catch (error) {
                        if (!error.toString().includes('nonce too low') && !error.toString().includes('underpriced')) {
                            throw new Error(error);
                        }

                        this.log.trace(`Nonce too low / underpriced detected. Retrying. ${error.toString()}`);
                        // eslint-disable-next-line no-await-in-loop
                        await sleep.sleep(2000);
                    }
                }
            } catch (e) {
                future.reject(e);
            }
            this.lastTransactionTime = Date.now();
            cb();
        }), { concurrent: 1 });
    }

    /**
     * Send transaction to Ethereum blockchain
     * @returns {PromiEvent<TransactionReceipt>}
     * @param newTransaction
     */
    async _sendTransaction(newTransaction) {
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

        const balance = await this.web3.eth.getBalance(this.walletAddress);
        const currentBalance = new BN(Utilities.denormalizeHex(balance), 16);
        const requiredAmount = new BN(300000).mul(new BN(newTransaction.options.gasPrice));

        // If current ballance not enough for 300000 gas notify low ETH balance
        if (currentBalance.lt(requiredAmount)) {
            this.log.warn(`ETH balance running low! Your balance: ${currentBalance.toString()}  wei, while minimum required is: ${requiredAmount.toString()} wei`);
        }

        this.log.trace(`Sending transaction to blockchain, nonce ${newTransaction.options.nonce}, balance is ${currentBalance.toString()}`);
        return this.web3.eth.sendSignedTransaction(`0x${serializedTx}`);
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
            const transaction = {
                contractAbi, method, args, options,
            };

            this.queue.push({
                transaction,
                future: {
                    resolve, reject,
                },
            });
        }));
    }
}

module.exports = Transactions;
