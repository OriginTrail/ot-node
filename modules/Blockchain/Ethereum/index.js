const Web3 = require('web3');
const fs = require('fs');
const Transactions = require('./Transactions');
const Utilities = require('../../Utilities');
const globalEvents = require('../../GlobalEvents');

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
        return this.transactions.queueTransaction(this.escrowContractAbi, 'verifyEscrow', [dcWallet, dataId, tokenAmount, stakeAmount, Math.round(totalTime / 1000)], options);
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
        return this.transactions.queueTransaction(this.escrowContractAbi, 'cancelEscrow', [dhWallet, dataId], options);
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
     * @param dataId Data ID of the bid
     * @param nodeId KADemlia node ID of offer creator
     * @param totalEscrowTime Total time of the escrow in milliseconds
     * @param maxTokenAmount Maximum price per DH
     * @param MinStakeAmount Minimum stake in tokens
     * @param biddingTime Total time of the bid in milliseconds
     * @param minNumberOfBids Number of bid required for offer to be successful
     * @param dataSize Size of the data for storing in bytes
     * @param ReplicationFactor Number of replications
     * @returns {Promise<any>} Return choose start-time.
     */
    createOffer(
        dataId, nodeId,
        totalEscrowTime,
        maxTokenAmount,
        MinStakeAmount,
        biddingTime,
        minNumberOfBids,
        dataSize, ReplicationFactor,
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        log.warn('Initiating escrow - createOffer');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'createOffer',
            [dataId, this._normalizeNodeId(nodeId),
                Math.round(totalEscrowTime / 1000),
                maxTokenAmount,
                MinStakeAmount,
                Math.round(biddingTime / 1000),
                minNumberOfBids,
                dataSize, ReplicationFactor], options,
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
     * Subscribe to a particular event
     * @param contractName   Ethereum contract instance
     * @param event          Event name
     * @param eventOpts      Event options (filter, range, etc.)
     * @param callback       Callback to be executed on success/error (callback returns stop flag)
     * @param periodMills    Repeating period for checking past events
     * @param untilMills     Subscription termination
     */
    subscribeToEvent(contractName, event, eventOpts, callback, periodMills, untilMills) {
        const looper = setInterval(() => {
            if (untilMills < Date.now()) {
                log.trace('Looper for event is going to be unsubscribed');
                clearTimeout(looper);
                return;
            }
            this.contractsByName[contractName].getPastEvents(event, eventOpts).then((events) => {
                const stop = callback(events);
                if (stop) {
                    clearTimeout(looper);
                }
            }).catch((err) => {
                log.error(`Failed to get past events for ${event}`);
                const stop = callback(null, err);
                if (stop) {
                    clearTimeout(looper);
                }
            });
        }, periodMills);
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
     * Reveals the bid of the offer
     * @param dcWallet Wallet of the DC who's offer is
     * @param dataId Id of the data in the offer
     * @param nodeId KADemlia ID of bidder
     * @param tokenAmount Amount of the token
     * @param stakeAmount Amount of the stake
     * @param bidIndex Index of the bid
     * @returns {Promise<any>}
     */
    revealBid(dcWallet, dataId, nodeId, tokenAmount, stakeAmount, bidIndex) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        log.warn('Initiating escrow - revealBid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'revealBid',
            [dcWallet,
                dataId,
                this._normalizeNodeId(nodeId), tokenAmount, stakeAmount, bidIndex], options,
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
