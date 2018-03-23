const utilities = require('../../utilities')();
const Web3 = require('web3');
const fs = require('fs');
const util = require('ethereumjs-util');
const tx = require('ethereumjs-tx');
const lightwallet = require('eth-lightwallet');
const Account = require('eth-lib/lib/account');
const Hash = require('eth-lib/lib/hash');
const BN = require('bn.js');
const abi = require('ethereumjs-abi');

//----------------
const transacting = require('./transacting');
//---------------

// eslint-disable-next-line  prefer-destructuring
const txutils = lightwallet.txutils;
const config = utilities.getConfig();
const log = utilities.getLogger();

// eslint-disable-next-line  prefer-destructuring
const wallet_address = config.blockchain.settings.ethereum.wallet_address;
// eslint-disable-next-line  prefer-destructuring
const private_key = config.blockchain.settings.ethereum.private_key;

const web3 = new Web3(new Web3.providers.HttpProvider(`${config.blockchain.settings.ethereum.rpc_node}:${config.blockchain.settings.ethereum.node_port}`));


// OT contract data
// eslint-disable-next-line  prefer-destructuring
const contract_address = config.blockchain.settings.ethereum.contract_address;
const contract_abi_path = config.blockchain.settings.ethereum.contract_abi;
const contract_abi_file = fs.readFileSync(contract_abi_path);
const contract_abi = JSON.parse(contract_abi_file);

// Token contract data
const token_address = config.blockchain.settings.ethereum.token_contract;
const token_abi_path = config.blockchain.settings.ethereum.token_abi;
const token_abi_file = fs.readFileSync(token_abi_path);
const token_abi = JSON.parse(token_abi_file);

// Escrow contract data
const escrow_address = config.blockchain.settings.ethereum.escrow_contract;
const escrow_abi_path = config.blockchain.settings.ethereum.escrow_abi;
const escrow_abi_file = fs.readFileSync(escrow_abi_path);
const escrow_abi = JSON.parse(escrow_abi_file);

/*
console.log('------------------------');
var nonce = 5;
web3.eth.getTransactionCount("0x11f4d0A3c12e86B4b5F39B213F7E19D048276DAe",
    web3.eth.defaultBlock,function(err, result) {
}).then(function (nonce){console.log(nonce)})
console.log('------------------------'); */

let nonce = -1;
let nonce_increment = 0;

module.exports = function () {


    // eslint-disable-next-line no-shadow
    function sendTransaction(abi, method, args, txOptions) {
        // eslint-disable-next-line no-shadow
        return new Promise((resolve, reject) => {
            // eslint-disable-next-line no-shadow
            web3.eth.getTransactionCount(wallet_address).then((nonce) => {
                txOptions.nonce = nonce;

                // log.info(method);
                log.warn(txOptions);

                const rawTx = txutils.functionTx(abi, method, args, txOptions);
                // return sendRaw(rawTx).then((response) => {
                //     if (response.error === '0x0') {
                //         return reject(response);
                //     }
                //     return resolve(response);
                // }).catch((err) => {
                //     reject(err);
                // });

                transacting.queueTransaction(rawTx, (response, err) => {
                    if(err) {
                        reject(err)
                    } else {
                        resolve(response)
                    }
                })

            });
        });
    }

    const signing = {

    sendRaw(rawTx) {
        // eslint-disable-next-line no-buffer-constructor
        const privateKey = new Buffer(private_key, 'hex');
        // eslint-disable-next-line new-cap
        const transaction = new tx(rawTx);
        transaction.sign(privateKey);
        const serializedTx = transaction.serialize().toString('hex');
        return web3.eth.sendSignedTransaction(`0x${serializedTx}`);
    },

    signAndSend(batch_id, batch_id_hash, graph_hash) {
        const txOptions = {
            gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
            gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
            to: contract_address,
        };

        return sendTransaction(contract_abi, 'addFingerPrint', [batch_id, batch_id_hash, graph_hash], txOptions);
    },

    signAndAllow(options) {
        const approvalFunction = this.listenApproval;
        const createEscrowFunction = this.createEscrow;

        return new Promise((resolve, reject) => {
            const txOptions = {
                gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
                gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
                to: token_address,
            };

            sendTransaction(token_abi, 'increaseApproval', [escrow_address, options.amount], txOptions).then((response) => {
                    // log.info(response);

                    log.info('Creating Escrow...');
                    // eslint-disable-next-line max-len
                    createEscrowFunction(options.dh_wallet, options.import_id, options.amount, options.start_time, options.total_time).then((result) => {
                        log.info('Escrow created');
                        resolve(result);
                    }).catch((e) => {
                        log.error('Escrow creation failed');
                        reject(e);
                    });
                }).catch((e) => {
                    log.error('Not Approved!');
                    console.log(e);
                    reject(e);
                });
            });
    },

    createEscrow(DH_wallet, data_id, token_amount, start_time, total_time, callback) {
        const txOptions = {
            gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
            gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
            to: escrow_address,
        };

        return sendTransaction(escrow_abi, 'initiateEscrow', [DH_wallet, data_id, token_amount, start_time, total_time], txOptions);
    },

        // eslint-disable-next-line max-len
        createConfirmation(DH_wallet, data_id, confirmation_verification_number, confirmation_time, confirmation_valid) {
            /*
      address DC_wallet, uint data_id,
      uint confirmation_verification_number, uint confirmation_time, bool confirmation_valid,
      bytes32 confirmation_hash, uint8 v, bytes32 r, bytes32 s
      */
            // eslint-disable-next-line max-len
            // (msg.sender, data_id, confirmation_verification_number, confirmation_time, confirmation_valid) === confirmation_hash
            const raw_data = `0x${abi.soliditySHA3(
                ['address', 'uint', 'uint', 'uint', 'bool'],
                // eslint-disable-next-line max-len
                [new BN(DH_wallet, 16), data_id, confirmation_verification_number, confirmation_time, confirmation_valid],
                ).toString('hex')}`;

            const hash = utilities.sha3(raw_data);
            const signature = Account.sign(hash, `0x${private_key}`);
            const vrs = Account.decodeSignature(signature);
            const s = {
                message: raw_data,
                messageHash: hash,
                v: vrs[0],
                r: vrs[1],
                s: vrs[2],
                signature,
            };

            const confirmation = {
                DC_wallet: wallet_address,
                data_id,
                confirmation_verification_number,
                confirmation_time,
                confirmation_valid,
                v: s.v,
                r: s.r,
                s: s.s,
                confirmation_hash: s.message,
            };

            return confirmation;
        },
        // sendRawX(rawTx, callback) {
        //     // eslint-disable-next-line no-buffer-constructor
        //     const privateKey = new Buffer(private_key, 'hex');
        //     // eslint-disable-next-line new-cap
        //     const transaction = new tx(rawTx);
        //     transaction.sign(privateKey);
        //     const serializedTx = transaction.serialize().toString('hex');
        //     web3.eth.sendSignedTransaction(`0x${serializedTx}`, (err, result) => {
        //         if (err) {
        //             console.log(err);

        //             if (callback) {
        //                 utilities.executeCallback(callback, false);
        //             }
        //         } else {
        //             if (callback) {
        //                 utilities.executeCallback(callback, result);
        //             }
        //             console.log('Transaction: ', result);
        //         }
        //     });
        // },

        async sendConfirmation(confirmation, callback) {
            if (nonce === -1) { nonce = await web3.eth.getTransactionCount(wallet_address); }

            const new_nonce = nonce + nonce_increment;
            nonce_increment += 1;

            const txOptions = {
                nonce: new_nonce,
                gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
                gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
                to: escrow_address,
            };

            console.log(txOptions);

            const rawTx = txutils.functionTx(escrow_abi, 'payOut', [confirmation.DC_wallet,
                confirmation.data_id,
                confirmation.confirmation_verification_number,
                confirmation.confirmation_time,
                confirmation.confirmation_valid,
                confirmation.confirmation_hash,
                confirmation.v,
                confirmation.r,
                confirmation.s], txOptions);
            transacting.queueTransaction(rawTx,callback);
           // this.sendRawX(rawTx, callback);
        },

    };

    return signing;
};
