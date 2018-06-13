const fs = require('fs');
const Transactions = require('./Transactions');
const Utilities = require('../../Utilities');
const Storage = require('../../Storage');
const Op = require('sequelize/lib/operators');

class Ethereum {
    /**
     * Initializing Ethereum blockchain connector
     * @param blockchainConfig
     * @param emitter
     * @param web3
     * @param log
     */
    constructor(blockchainConfig, emitter, web3, log) {
        // Loading Web3
        this.emitter = emitter;
        this.web3 = web3;
        this.log = log;

        this.transactions = new Transactions(
            this.web3,
            blockchainConfig.wallet_private_key,
            blockchainConfig.wallet_address,
        );

        // Loading contracts
        this.otContractAddress = blockchainConfig.ot_contract_address;
        this.tokenContractAddress = blockchainConfig.token_contract_address;
        this.escrowContractAddress = blockchainConfig.escrow_contract_address;
        this.biddingContractAddress = blockchainConfig.bidding_contract_address;
        this.readingContractAddress = blockchainConfig.reading_contract_address;

        // OT contract data
        const contractAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/ot-contract/abi.json');
        this.otContractAbi = JSON.parse(contractAbiFile);
        this.otContract = new this.web3.eth.Contract(this.otContractAbi, this.otContractAddress);

        // Token contract data
        const tokenAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/token-contract/abi.json');
        this.tokenContractAbi = JSON.parse(tokenAbiFile);
        this.tokenContract = new this.web3.eth.Contract(
            this.tokenContractAbi,
            this.tokenContractAddress,
        );

        // Escrow contract data
        const escrowAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/escrow-contract/abi.json');
        this.escrowContractAbi = JSON.parse(escrowAbiFile);
        this.escrowContract = new this.web3.eth.Contract(
            this.escrowContractAbi,
            this.escrowContractAddress,
        );

        // Bidding contract data
        const biddingAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/bidding-contract/abi.json');
        this.biddingContractAbi = JSON.parse(biddingAbiFile);
        this.biddingContract = new this.web3.eth.Contract(
            this.biddingContractAbi,
            this.biddingContractAddress,
        );

        // Reading contract data
        const readingAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/reading-contract/abi.json');
        this.readingContractAbi = JSON.parse(readingAbiFile);
        this.readingContract = new this.web3.eth.Contract(
            this.readingContractAbi,
            this.readingContractAddress,
        );


        this.contractsByName = {
            BIDDING_CONTRACT: this.biddingContract,
            READING_CONTRACT: this.readingContract,
        };

        // Storing config data
        this.config = blockchainConfig;

        this.biddingContract.events.OfferCreated()
            .on('data', (event) => {
                console.log(event); // same results as the optional callback above
                emitter.emit('eth-offer-created', event);
            })
            .on('error', log.warn);

        this.biddingContract.events.OfferCanceled()
            .on('data', (event) => {
                console.log(event); // same results as the optional callback above
                emitter.emit('eth-offer-canceled', event);
            })
            .on('error', this.log.warn);

        this.biddingContract.events.BidTaken()
            .on('data', (event) => {
                console.log(event); // same results as the optional callback above
                emitter.emit('eth-bid-taken', event);
            })
            .on('error', this.log.warn);


        this.log.info('Selected blockchain: Ethereum');
    }

    /**
     * Writes data import root hash on Ethereum blockchain
     * @param importId
     * @param rootHash
     * @returns {Promise}
     */
    writeRootHash(importId, rootHash) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.otContractAddress,
        };

        const importIdHash = Utilities.sha3(importId);

        this.log.warn('Writing root hash');
        return this.transactions.queueTransaction(this.otContractAbi, 'addFingerPrint', [importId, importIdHash, rootHash], options);
    }

    /**
     * Gets root hash for import
     * @param dcWallet DC wallet
     * @param dataId   Import ID
     * @return {Promise<any>}
     */
    async getRootHash(dcWallet, dataId) {
        const dataIdHash = Utilities.sha3(dataId.toString());
        this.log.trace('Fetching root hash for: ', dcWallet, dataIdHash);
        return this.otContract.methods.getFingerprintByBatchHash(dcWallet, dataIdHash).call();
    }

    /**
     * Gets profile by wallet
     * @param wallet
     */
    getProfile(wallet) {
        return new Promise((resolve, reject) => {
            this.log.trace(`Get profile by wallet ${wallet}`);
            this.biddingContract.methods.profile(wallet).call({
                from: wallet,
            }).then((res) => {
                resolve(res);
            }).catch((e) => {
                reject(e);
            });
        });
    }

    /**
     * Creates node profile on the Bidding contract
     * @param nodeId        Kademlia node ID
     * @param pricePerByteMinute Price for byte per minute
     * @param stakePerByteMinute Stake for byte per minute
     * @param readStakeFactor Read stake factor
     * @param maxTimeMins   Max time in minutes
     * @param maxSizeBytes  Max size in bytes
     * @return {Promise<any>}
     */
    createProfile(
        nodeId, pricePerByteMinute, stakePerByteMinute,
        readStakeFactor, maxTimeMins, maxSizeBytes,
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.trace(`Create profile for node ${nodeId}`);
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'createProfile',
            [Utilities.normalizeHex(nodeId), pricePerByteMinute, stakePerByteMinute,
                readStakeFactor, maxTimeMins, maxSizeBytes], options,
        );
    }

    /**
     * Increase token approval for escrow contract on Ethereum blockchain
     * @param {number} tokenAmountIncrease
     * @returns {Promise}
     */
    increaseApproval(tokenAmountIncrease) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.tokenContractAddress,
        };
        this.log.warn('Increasing approval for escrow');
        return this.transactions.queueTransaction(this.tokenContractAbi, 'increaseApproval', [this.escrowContractAddress, tokenAmountIncrease], options);
    }

    /**
     * Increase token approval for Bidding contract on Ethereum blockchain
     * @param {number} tokenAmountIncrease
     * @returns {Promise}
     */
    increaseBiddingApproval(tokenAmountIncrease) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.tokenContractAddress,
        };
        this.log.warn('Increasing bidding approval');
        return this.transactions.queueTransaction(this.tokenContractAbi, 'increaseApproval', [this.biddingContractAddress, tokenAmountIncrease], options);
    }

    /**
     * Verify escrow contract contract data and start data holding process on Ethereum blockchain
     * @param importId
     * @param dhWallet
     * @returns {Promise}
     */
    verifyEscrow(importId, dhWallet) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        this.log.warn(`Verifying escrow for import ${importId} and DH ${dhWallet}`);
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'verifyEscrow',
            [
                importId,
                dhWallet,
            ],
            options,
        );
    }

    /**
     * Cancel data holding escrow process on Ethereum blockchain
     * @param {string} - dhWallet
     * @param {number} - importId
     * @returns {Promise}
     */
    cancelEscrow(dhWallet, importId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        this.log.warn('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'cancelEscrow',
            [
                dhWallet,
                importId,
            ],
            options,
        );
    }

    /**
     * Pay out tokens from escrow on Ethereum blockchain
     * @param {string} - dcWallet
     * @param {number} - importId
     * @returns {Promise}
     */
    payOut(dcWallet, importId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        this.log.warn('Initiating escrow - payOut');
        return this.transactions.queueTransaction(this.escrowContractAbi, 'payOut', [dcWallet, importId], options);
    }

    /**
     * Creates offer for the data storing on the Ethereum blockchain.
     * @param importId Import ID of the offer.
     * @param nodeId KADemlia node ID of offer creator
     * @param totalEscrowTime Total time of the escrow in milliseconds
     * @param maxTokenAmount Maximum price per DH
     * @param MinStakeAmount Minimum stake in tokens
     * @param minReputation Minimum required reputation
     * @param dataHash Hash of the data put to the offer
     * @param dataSize Size of the data for storing in bytes
     * @param predeterminedDhWallets Array of predetermined DH wallets to be used in offer
     * @param predeterminedDhNodeIds Array of predetermined node IDs to be used in offer
     * @returns {Promise<any>} Return choose start-time.
     */
    createOffer(
        importId, nodeId,
        totalEscrowTime,
        maxTokenAmount,
        MinStakeAmount,
        minReputation,
        dataHash,
        dataSize,
        predeterminedDhWallets,
        predeterminedDhNodeIds,
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.warn('Calling - createOffer() on contract.');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'createOffer',
            [
                importId,
                Utilities.normalizeHex(nodeId),
                Math.round(totalEscrowTime / 1000 / 60), // In minutes
                maxTokenAmount,
                MinStakeAmount,
                minReputation,
                dataHash,
                dataSize,
                predeterminedDhWallets,
                predeterminedDhNodeIds.map(id => Utilities.normalizeHex(id)),
            ],
            options,
        );
    }

    /**
     * Cancel offer for data storing on Ethereum blockchain.
     * @param importId Data if of the offer.
     */
    cancelOffer(importId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.warn('Initiating escrow - cancelOffer');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'cancelOffer',
            [importId], options,
        );
    }

    /**
     * Gets all past events for the contract
     * @param contractName
     */
    getAllPastEvents(contractName) {
        Utilities.getBlockNumberFromWeb3().then((currentBlockHex) => {
            const currentBlock = Utilities.hexToNumber(currentBlockHex);
            this.contractsByName[contractName].getPastEvents('allEvents', {
                fromBlock: Math.min(currentBlock, 10),
                toBlock: 'latest',
            }).then((events) => {
                events.forEach((event) => {
                    // TODO: make filters - we don't need to listen all events
                    /* eslint-disable-next-line */
                    if (event.event === 'OfferCreated' || 1 === 1) {
                        const timestamp = Date.now();
                        Storage.db.query('INSERT INTO events(event, data, import_id, block, timestamp, finished) \n' +
                          'SELECT ?, ?, ?, ?, ?, 0 \n' +
                          'WHERE NOT EXISTS(SELECT 1 FROM events WHERE event = ? AND data = ?)', {
                            replacements: [
                                event.event,
                                JSON.stringify(event.returnValues),
                                event.returnValues.import_id,
                                event.blockNumber,
                                timestamp,
                                event.event,
                                JSON.stringify(event.returnValues),
                            ],
                        }).catch((err) => {
                            console.log(err);
                        });
                    }
                });

                // Delete old events
                Storage.db.query('DELETE FROM events WHERE block < ?', {
                    replacements: [currentBlock - 10],
                }).catch((err) => {
                    console.log(err);
                });
            }).catch((err) => {
                this.log.error('Failed to get past events');
                console.log(err);
            });
        }).catch((err) => {
            this.log.error('Failed to get block number from the blockchain');
            console.log(err);
        });
    }

    /**
    * Subscribes to blockchain events
    * @param event
    * @param importId
    * @param endMs
    * @param endCallback
    */
    subscribeToEvent(event, importId, endMs = 5 * 60 * 1000, endCallback) {
        return new Promise((resolve, reject) => {
            const token = setInterval(() => {
                const where = {
                    event,
                    finished: 0,
                };
                if (importId) {
                    where.import_id = importId;
                }
                Storage.models.events.findOne({
                    where,
                }).then((eventData) => {
                    if (eventData) {
                        this.emitter.emit(event, eventData.dataValues);
                        eventData.finished = true;
                        eventData.save().then(() => {
                            clearInterval(token);
                            resolve(JSON.parse(eventData.dataValues.data));
                        }).catch((err) => {
                            this.log.error(`Failed to update event ${event}. ${err}`);
                            reject(err);
                        });
                    }
                });
            }, 2000);
            setTimeout(() => {
                if (endCallback) {
                    endCallback();
                }
                clearInterval(token);
                resolve(null);
            }, endMs);
        });
    }

    /**
     * Subscribes to Blockchain event
     *
     * Calling this method will subscribe to Blockchain's event which will be
     * emitted globally using globalEmitter.
     * @param event Event to listen to
     * @returns {number | Object} Event handle
     */
    subscribeToEventPermanent(event) {
        const handle = setInterval(async () => {
            const startBlockNumber = parseInt(await Utilities.getBlockNumberFromWeb3(), 16);

            const where = {
                [Op.or]: event.map(e => ({ event: e })),
                block: { [Op.gte]: startBlockNumber },
                finished: 0,
            };

            const eventData = await Storage.models.events.findAll({ where });
            if (eventData) {
                eventData.forEach(async (data) => {
                    this.emitter.emit(`eth-${data.event}`, JSON.parse(data.dataValues.data));
                    data.finished = true;
                    await data.save();
                });
            }
        }, 2000);

        return handle;
    }

    unsubscribeToEventPermanent(eventHandle) {
        clearInterval(eventHandle);
    }


    /**
     * Adds bid to the offer on Ethereum blockchain
     * @param importId Hash of the offer
     * @param dhNodeId KADemlia ID of the DH node that wants to add bid
     * @returns {Promise<any>} Index of the bid.
     */
    addBid(importId, dhNodeId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.warn('Initiating escrow - addBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'addBid',
            [importId, Utilities.normalizeHex(dhNodeId)], options,
        );
    }

    /**
     * Cancel the bid on Ethereum blockchain
     * @param dcWallet Wallet of the bidder
     * @param importId ID of the data of the bid
     * @param bidIndex Index of the bid
     * @returns {Promise<any>}
     */
    cancelBid(dcWallet, importId, bidIndex) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        this.log.warn('Initiating escrow - cancelBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'cancelBid',
            [dcWallet, importId, bidIndex], options,
        );
    }

    /**
     * Starts choosing bids from contract escrow on Ethereum blockchain
     * @param importId Import ID
     * @returns {Promise<any>}
     */
    chooseBids(importId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.warn('Initiating escrow - chooseBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'chooseBids',
            [importId], options,
        );
    }

    /**
     *
     * @param dcWallet
     * @param importId
     * @param bidIndex
     * @returns {Promise<any>}
     */
    getBid(dcWallet, importId, bidIndex) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.warn('Initiating escrow - getBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'getBid',
            [dcWallet, importId, bidIndex], options,
        );
    }

    /**
    * Gets status of the offer
    * @param dcWallet
    * @param importId
    * @return {Promise<any>}
    */
    getOfferStatus(dcWallet, importId) {
        return new Promise((resolve, reject) => {
            this.log.trace(`Asking for ${importId} offer status`);
            this.biddingContract.methods.getOfferStatus(dcWallet, importId).call({
                from: dcWallet,
            }).then((res) => {
                resolve(res);
            }).catch((e) => {
                reject(e);
            });
        });
    }

    getDcWalletFromOffer(importId) {
        return new Promise((resolve, reject) => {
            this.log.trace(`Asking for offer's (${importId}) DC wallet.`);
            this.biddingContract.methods.offer(importId).call()
                .then((res) => {
                    resolve(res[0]);
                }).catch((e) => {
                    reject(e);
                });
        });
    }

    async depositToken(amount) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.warn(`Calling - depositToken(${amount.toString()})`);
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'depositToken',
            [amount], options,
        );
    }

    async addRootHashAndChecksum(importId, litigationHash, distributionHash, checksum) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        checksum = Utilities.normalizeHex(checksum);
        this.log.trace(`addRootHashAndChecksum (${importId}, ${litigationHash}, ${distributionHash}, ${checksum})`);
        return this.transactions.queueTransaction(
            this.escrowContractAbi, 'addRootHashAndChecksum',
            [importId, litigationHash, distributionHash, checksum], options,
        );
    }

    /**
     * Gets Escrow
     * @param dhWallet
     * @param importId
     * @return {Promise<any>}
     */
    async getEscrow(importId, dhWallet) {
        this.log.trace(`Asking escrow for import ${importId} and dh ${dhWallet}.`);
        return this.escrowContract.methods.escrow(importId, dhWallet).call();
    }

    async getPurchase(dhWallet, dvWallet, importId) {
        this.log.trace(`Asking purchase for import (purchase[${dhWallet}][${dvWallet}][${importId}].`);
        return this.readingContract.methods.purchase(dhWallet, dvWallet, importId).call();
    }

    async getPurchasedData(importId, wallet) {
        this.log.trace(`Asking purchased data for import ${importId} and wallet ${wallet}.`);
        return this.readingContract.methods.purchased_data(importId, wallet).call();
    }

    initiatePurchase(importId, dhWallet, tokenAmount, stakeFactor) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`initiatePurchase (${importId}, ${dhWallet}, ${tokenAmount}, ${stakeFactor})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'initiatePurchase',
            [importId, dhWallet, tokenAmount, stakeFactor], options,
        );
    }

    sendCommitment(importId, dvWallet, commitment) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`sendCommitment (${importId}, ${dvWallet}, ${commitment})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendCommitment',
            [importId, dvWallet, commitment], options,
        );
    }

    initiateDispute(importId, dhWallet) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`initiateDispute (${importId}, ${dhWallet})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'initiateDispute',
            [importId, dhWallet], options,
        );
    }

    confirmPurchase(importId, dhWallet) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`confirmPurchase (${importId}, ${dhWallet})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'confirmPurchase',
            [importId, dhWallet], options,
        );
    }

    cancelPurchase(importId, correspondentWallet, senderIsDh) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`confirmPurchase (${importId}, ${correspondentWallet}, ${senderIsDh})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'confirmPurchase',
            [importId, correspondentWallet, senderIsDh], options,
        );
    }

    sendProofData(
        importId, dvWallet, checksumLeft, checksumRight, checksumHash,
        randomNumber1, randomNumber2, decryptionKey, blockIndex,
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace('sendProofData ()');
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendProofData',
            [
                importId, dvWallet, checksumLeft, checksumRight, checksumHash,
                randomNumber1, randomNumber2, decryptionKey, blockIndex,
            ], options,
        );
    }

    async sendEncryptedBlock(importId, dvWallet, encryptedBlock) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`sendEncryptedBlock (${importId}, ${dvWallet}, ${encryptedBlock})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendEncryptedBlock',
            [importId, dvWallet, encryptedBlock], options,
        );
    }
}

module.exports = Ethereum;
