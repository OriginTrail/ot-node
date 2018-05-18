const Web3 = require('web3');
const fs = require('fs');
const Transactions = require('./Transactions');
const Utilities = require('../../Utilities');
const globalEvents = require('../../GlobalEvents');
const SystemStorage = require('../../Database/SystemStorage');
const Storage = require('../../Storage');
const Op = require('sequelize/lib/operators');

const { globalEmitter } = globalEvents;

const log = Utilities.getLogger();

class Ethereum {
    /**
     * Initializing Ethereum blockchain connector
     * @param {object} - blockchainConfig
     */
    constructor(blockchainConfig) {
        // Loading Web3
        this.web3 = new Web3(new Web3.providers.HttpProvider(`${blockchainConfig.rpc_node_host}:${blockchainConfig.rpc_node_port}`));
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

        const biddingAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/bidding-contract/abi.json');
        this.biddingContractAbi = JSON.parse(biddingAbiFile);
        this.biddingContract = new this.web3.eth.Contract(
            this.biddingContractAbi,
            this.biddingContractAddress,
        );

        this.contractsByName = {
            BIDDING_CONTRACT: this.biddingContract,
        };

        // Storing config data
        this.config = blockchainConfig;

        this.biddingContract.events.OfferCreated()
            .on('data', (event) => {
                console.log(event); // same results as the optional callback above
                globalEmitter.emit('eth-offer-created', event);
            })
            .on('error', log.warn);

        this.biddingContract.events.OfferCanceled()
            .on('data', (event) => {
                console.log(event); // same results as the optional callback above
                globalEmitter.emit('eth-offer-canceled', event);
            })
            .on('error', log.warn);

        this.biddingContract.events.BidTaken()
            .on('data', (event) => {
                console.log(event); // same results as the optional callback above
                globalEmitter.emit('eth-bid-taken', event);
            })
            .on('error', log.warn);


        log.info('Selected blockchain: Ethereum');
    }

    /**
     * Writes data import root hash on Ethereum blockchain
     * @param dataId
     * @param rootHash
     * @returns {Promise}
     */
    writeRootHash(dataId, rootHash) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.otContractAddress,
        };

        const dataIdHash = Utilities.sha3(dataId);

        log.warn('Writing root hash');
        return this.transactions.queueTransaction(this.otContractAbi, 'addFingerPrint', [dataId, dataIdHash, rootHash], options);
    }

    /**
     * Gets profile by wallet
     * @param wallet
     */
    getProfile(wallet) {
        return new Promise((resolve, reject) => {
            log.trace(`Get profile by wallet ${wallet}`);
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
     * @param price         Price (byte per min)
     * @param stakeFactor   Stake factor
     * @param maxTimeMins   Max time in minutes
     * @param maxSizeBytes  Max size in bytes
     * @return {Promise<any>}
     */
    createProfile(nodeId, price, stakeFactor, maxTimeMins, maxSizeBytes) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        log.trace(`Create profile for node ${nodeId}`);
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'createProfile',
            [this._normalizeNodeId(nodeId), price,
                stakeFactor, maxTimeMins,
                maxSizeBytes], options,
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
        log.warn('Increasing approval for escrow');
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
        log.warn('Increasing bidding approval');
        return this.transactions.queueTransaction(this.tokenContractAbi, 'increaseApproval', [this.biddingContractAddress, tokenAmountIncrease], options);
    }

    /**
     * Verify escrow contract contract data and start data holding process on Ethereum blockchain
     * @param {string} - dcWallet
     * @param {number} - dataId
     * @param {number} - tokenAmount
     * @param {number} - stakeAmount
     * @param {number} - totalTime
     * @returns {Promise}
     */
    verifyEscrow(dcWallet, dataId, tokenAmount, stakeAmount, totalTime) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        log.warn('Verifying escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'verifyEscrow',
            [
                dcWallet,
                dataId,
                tokenAmount,
                stakeAmount,
                Math.round(totalTime / 1000 / 60),
            ],
            options,
        );
    }

    /**
     * Cancel data holding escrow process on Ethereum blockchain
     * @param {string} - dhWallet
     * @param {number} - dataId
     * @returns {Promise}
     */
    cancelEscrow(dhWallet, dataId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'cancelEscrow',
            [
                dhWallet,
                dataId,
            ],
            options,
        );
    }

    /**
     * Pay out tokens from escrow on Ethereum blockchain
     * @param {string} - dcWallet
     * @param {number} - dataId
     * @returns {Promise}
     */
    payOut(dcWallet, dataId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow - payOut');
        return this.transactions.queueTransaction(this.escrowContractAbi, 'payOut', [dcWallet, dataId], options);
    }

    /**
     * Creates offer for the data storing on the Ethereum blockchain.
     * @param dataId Data ID of the offer.
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
        dataId, nodeId,
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

        log.warn('Calling - createOffer() on contract.');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'createOffer',
            [
                dataId,
                this._normalizeNodeId(nodeId),
                Math.round(totalEscrowTime / 1000 / 60), // In minutes
                maxTokenAmount,
                MinStakeAmount,
                minReputation,
                dataHash,
                dataSize,
                predeterminedDhWallets,
                predeterminedDhNodeIds.map(id => this._normalizeNodeId(id)),
            ],
            options,
        );
    }

    /**
     * Cancel offer for data storing on Ethereum blockchain.
     * @param dataId Data if of the offer.
     */
    cancelOffer(dataId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        log.warn('Initiating escrow - cancelOffer');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'cancelOffer',
            [dataId], options,
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
                        Storage.db.query('INSERT INTO events(event,data, dataId, block, createdAt, updatedAt, finished) \n' +
                          'SELECT ?, ?, ?, ?, ?, ?, 0 \n' +
                          'WHERE NOT EXISTS(SELECT 1 FROM events WHERE event = ? AND data = ?)', {
                            replacements: [
                                event.event,
                                JSON.stringify(event.returnValues),
                                event.returnValues.data_id,
                                event.blockNumber,
                                timestamp,
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
                log.error('Failed to get past events');
                console.log(err);
            });
        }).catch((err) => {
            log.error('Failed to get block number from the blockchain');
            console.log(err);
        });
    }

    /**
    * Subscribes to blockchain events
    * @param event
    * @param dataId
    * @param endMs
    * @param endCallback
    */
    subscribeToEvent(event, dataId, endMs = 5 * 60 * 1000, endCallback) {
        return new Promise((resolve, reject) => {
            const token = setInterval(() => {
                const where = {
                    event,
                    finished: 0,
                };
                if (dataId) {
                    where.dataId = dataId;
                }
                Storage.models.events.findOne({
                    where,
                }).then((eventData) => {
                    if (eventData) {
                        globalEmitter.emit(event, eventData.dataValues);
                        eventData.finished = true;
                        eventData.save().then(() => {
                            clearInterval(token);
                            resolve(JSON.parse(eventData.dataValues.data));
                        }).catch((err) => {
                            log.error(`Failed to update event ${event}. ${err}`);
                            reject(err);
                        });
                    }
                });
            }, 2000);
            setTimeout(() => {
                endCallback();
                clearInterval(token);
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
            const where = {
                [Op.or]: event.map(e => ({ event: e })),
                finished: 0,
            };

            const eventData = await Storage.models.events.findAll({ where });
            if (eventData) {
                eventData.forEach(async (data) => {
                    globalEmitter.emit(`eth-${data.event}`, JSON.parse(data.dataValues.data));
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
     * @param dcWallet Wallet of the bidder
     * @param dataId ID of the data of the bid
     * @param nodeId KADemlia ID of this node
     * @param bidHash Hashed bid that will be revealed once revealBid() is called
     * @returns {Promise<any>} Index of the bid.
     */
    addBid(dcWallet, dataId, nodeId, bidHash) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        log.warn('Initiating escrow - addBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'addBid',
            [dcWallet, dataId, this._normalizeNodeId(nodeId), bidHash], options,
        );
    }

    /**
     * Cancel the bid on Ethereum blockchain
     * @param dcWallet Wallet of the bidder
     * @param dataId ID of the data of the bid
     * @param bidIndex Index of the bid
     * @returns {Promise<any>}
     */
    cancelBid(dcWallet, dataId, bidIndex) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow - cancelBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'cancelBid',
            [dcWallet, dataId, bidIndex], options,
        );
    }

    /**
     * Starts choosing bids from contract escrow on Ethereum blockchain
     * @param dataId ID of data of the bid
     * @returns {Promise<any>}
     */
    chooseBids(dataId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        log.warn('Initiating escrow - chooseBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'chooseBids',
            [dataId], options,
        );
    }

    /**
     *
     * @param dcWallet
     * @param dataId
     * @param bidIndex
     * @returns {Promise<any>}
     */
    getBid(dcWallet, dataId, bidIndex) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        log.warn('Initiating escrow - getBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'getBid',
            [dcWallet, dataId, bidIndex], options,
        );
    }

    /**
    * Gets status of the offer
    * @param dcWallet
    * @param dataId
    * @return {Promise<any>}
    */
    getOfferStatus(dcWallet, dataId) {
        return new Promise((resolve, reject) => {
            log.trace(`Asking for ${dataId} offer status`);
            this.biddingContract.methods.getOfferStatus(dcWallet, dataId).call({
                from: dcWallet,
            }).then((res) => {
                resolve(res);
            }).catch((e) => {
                reject(e);
            });
        });
    }

    /**
     * Normalizes Kademlia node ID
     * @param nodeId     Kademlia node ID
     * @returns {string} Normalized node ID
     * @private
     */
    _normalizeNodeId(nodeId) {
        return `0x${nodeId}`;
    }
}

module.exports = Ethereum;
