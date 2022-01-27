const Web3 = require('web3');
const BigNumber = require('big-number');
const DKGContract = require('../build/contracts/DKGcontract.json').abi;
const constants = require('../modules/constants');

class Web3BlockchainService {
    constructor(config) {
        this.config = config;
    }

    initialize(logger) {
        this.logger = logger;
        this.rpcNumber = 0;
        this.web3 = new Web3(this.config.rpcEndpoints[0]);
    }

    getPrivateKey() {
        return this.config.privateKey;
    }

    getPublicKey() {
        return this.config.publicKey;
    }

    async sendProofs(assertion) {
        // const contractAddress = "0xF21dD87cFC5cF5D073398833AFe5EFC543b78a00";
        const contractAddress = this.config.hubContractAddress;
        const contractInstance = new this.web3.eth.Contract(DKGContract, contractAddress);

        const encodedABI = contractInstance.methods.createAssertionRecord(`0x${assertion.id}`,`0x${assertion.rootHash}`,
            new BigNumber(1),
            new BigNumber(1)).encodeABI();
        const tx = {
            from: this.config.publicKey,
            to: contractInstance.options.address,
            data: encodedABI,
            gasPrice: '2000000000',
            gas: '200000',
        };

        const createdTransaction = await this.web3.eth.accounts.signTransaction(tx, this.config.privateKey);
        const result = await this.web3.eth.sendSignedTransaction(createdTransaction.rawTransaction);
        return {transactionHash: result.transactionHash, blockchain: this.config.networkId};
    }

    async getProofs(proofs) {
        // const contractAddress = "0xF21dD87cFC5cF5D073398833AFe5EFC543b78a00";
        const contractAddress = this.config.hubContractAddress;
        const contractInstance = new this.web3.eth.Contract(DKGContract, contractAddress);

        const issuer = await contractInstance.methods.getAssertionIssuer(proofs).call();
        return issuer;
    }

    async healthCheck() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            if (gasPrice) return true;
        } catch (e) {
            this.logger.error({
                msg: `Error on checking blockchain. ${e}`,
                Event_name: constants.ERROR_TYPE.BLOCKCHAIN_CHECK_ERROR,
            });
            return false;
        }
        return false;
    }

    async restartService() {
        this.logger.info('There are issues with current RPC. Using fallback RPC endpoint.');
        this.rpcNumber = (this.rpcNumber + 1) % this.config.rpcEndpoints.length;
        this.web3 = new Web3(this.config.rpcEndpoints[this.rpcNumber]);
    }

    getName() {
        return 'Web3 module';
    }
}

module.exports = Web3BlockchainService;
