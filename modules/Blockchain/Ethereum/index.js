const Web3 = require('web3');
const fs = require('fs');
const Transactions = require('./Transactions');
const Utilities = require('../../Utilities');

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

        // Storing config data
        this.config = blockchainConfig;

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
        log.warn('Increasing approval');
        return this.transactions.queueTransaction(this.tokenContractAbi, 'increaseApproval', [this.escrowContractAddress, tokenAmountIncrease], options);
    }

    /**
     * Initiating escrow for data holding on Ethereum blockchain
     * @param {string} - dhWallet
     * @param {number} - dataId
     * @param {number} - tokenAmount
     * @param {number} - totalTime
     * @returns {Promise}
     */
    initiateEscrow(dhWallet, dataId, tokenAmount, totalTime) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(this.escrowContractAbi, 'initiateEscrow', [dhWallet, dataId, tokenAmount, totalTime], options);
    }

    /**
     * Verify escrow contract contract data and start data holding process on Ethereum blockchain
     * @param {string} - dcWallet
     * @param {number} - dataId
     * @param {number} - tokenAmount
     * @param {number} - totalTime
     * @returns {Promise}
     */
    verifyEscrow(dcWallet, dataId, tokenAmount, totalTime) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(this.escrowContractAbi, 'verifyEscrow', [dcWallet, dataId, tokenAmount, totalTime], options);
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

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(this.escrowContractAbi, 'payOut', [dcWallet, dataId], options);
    }

    /**
     * Creates offer for the data storing on the Ethereum blockchain.
     * @param dataId Data ID of the bid
     * @param nodeId KADemlia node ID of offer creator
     * @param totalEscrowTime Total time of the escrow in milliseconds
     * @param MinStakeAmount Minimum stake in tokens
     * @param biddingTime Total time of the bid in milliseconds
     * @param minNumberOfBids Number of bid required for offer to be successful
     * @param dataSize Size of the data for storing in bytes
     * @param ReplicationFactor Number of replications
     * @returns {Promise<any>} Return choose start-time.
     */
    createOffer(
        dataId, nodeId,
        totalEscrowTime, MinStakeAmount,
        biddingTime,
        minNumberOfBids,
        dataSize, ReplicationFactor,
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi, 'createOffer',
            [dataId, nodeId,
                totalEscrowTime, MinStakeAmount,
                biddingTime,
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
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi, 'cancelOffer',
            [dataId], options,
        );
    }

    /**
     * Adds bid to the offer on Ethereum blockchain
     * @param dcWallet Wallet of the bidder
     * @param dataId ID of the data of the bid
     * @param nodeId KADemlia ID of this node
     * @param tokenAmount Amount of token that will be paid if chosen in the bid
     * @param stakeAmount Amount of stake in tokens.
     * @returns {Promise<any>} Index of the bid.
     */
    addBid(dcWallet, dataId, nodeId, tokenAmount, stakeAmount) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi, 'addBid',
            [dcWallet, dataId, nodeId, tokenAmount, stakeAmount], options,
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

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi, 'cancelBid',
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
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi, 'revealBid',
            [dcWallet, dataId, nodeId, tokenAmount, stakeAmount, bidIndex], options,
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
            to: this.escrowContractAddress,
        };

        log.warn('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi, 'chooseBids',
            [dataId], options,
        );
    }

}

module.exports = Ethereum;
