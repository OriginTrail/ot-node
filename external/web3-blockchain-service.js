const Web3 = require('web3');
const BigNumber = require('big-number');
const axios = require('axios');
const DKGContract = require('../build/contracts/DKGcontract.json').abi;
const UAIRegistry = require('../build/contracts/UAIRegistry.json').abi;
const constants = require('../modules/constants');

class Web3BlockchainService {
    constructor(config) {
        this.config = config;
        this.gasStationLink = 'https://gasstation-mumbai.matic.today/v2';
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

    async getGasStationPrice() {
        const response = await axios.get(this.gasStationLink).catch((err) => {
            this.logger.warn(err);
            return undefined;
        });
        try {
            return Math.round(response.data.standard.maxFee * 1e9);
        } catch(e) {
            return undefined;
        }
    }

    async executeContractMethod(contractInstance, method, args) {
        const gasPrice = await this.getGasStationPrice();

        const gasLimit = await contractInstance.methods[method](...args).estimateGas({
            from: this.config.publicKey,
        });

        const encodedABI = contractInstance.methods[method](...args).encodeABI();
        const tx = {
            from: this.config.publicKey,
            to: contractInstance.options.address,
            data: encodedABI,
            gasPrice: gasPrice || this.web3.utils.toWei('20', 'Gwei'),
            gas: gasLimit || this.web3.utils.toWei('900', 'Kwei'),
        };

        const createdTransaction = await this.web3.eth.accounts.signTransaction(
            tx,
            this.config.privateKey,
        );
        const result = await this.web3.eth.sendSignedTransaction(createdTransaction.rawTransaction);
        return result;
    }

    async createAssertionRecord(stateCommitHash, rootHash, issuer) {
        const contractAddress = await this.getAssertionRegistryAddress();
        const contractInstance = new this.web3.eth.Contract(DKGContract, contractAddress);

        const result = await this.executeContractMethod(contractInstance, 'createAssertionRecord', [
            `0x${stateCommitHash}`,
            `0x${rootHash}`,
            issuer,
            new BigNumber(1),
            new BigNumber(1),
        ]);
        return { transactionHash: result.transactionHash, blockchain: this.config.networkId };
    }

    async registerAsset(uai, type, alsoKnownAs, stateCommitHash, rootHash, tokenAmount) {
        const contractAddress = this.config.hubContractAddress;
        const contractInstance = new this.web3.eth.Contract(UAIRegistry, contractAddress);

        const result = await this.executeContractMethod(contractInstance, 'registerAsset', [
            `0x${uai}`,
            0,
            `0x${uai}`,
            `0x${stateCommitHash}`,
            `0x${rootHash}`,
            1,
        ]);
        return { transactionHash: result.transactionHash, blockchain: this.config.networkId };
    }

    async updateAsset(UAI, newStateCommitHash, rootHash) {
        const contractAddress = this.config.hubContractAddress;
        const contractInstance = new this.web3.eth.Contract(UAIRegistry, contractAddress);

        const result = await this.executeContractMethod(contractInstance, 'updateAssetState', [
            `0x${UAI}`,
            `0x${newStateCommitHash}`,
            `0x${rootHash}`,
        ]);
        return { transactionHash: result.transactionHash, blockchain: this.config.networkId };
    }

    async getAssertionProofs(assertionId) {
        const contractAddress = await this.getAssertionRegistryAddress();
        const contractInstance = new this.web3.eth.Contract(DKGContract, contractAddress);

        const issuer = await contractInstance.methods.getAssertionIssuer(`0x${assertionId}`).call();
        const rootHash = await contractInstance.methods
            .getAssertionRootHash(`0x${assertionId}`)
            .call();
        return { issuer, rootHash };
    }

    async getAssetProofs(ual) {
        const contractAddress = this.config.hubContractAddress;
        const contractInstance = new this.web3.eth.Contract(UAIRegistry, contractAddress);

        const issuer = await contractInstance.methods.getAssetController(`0x${ual}`).call();
        let assertionId = await contractInstance.methods.getAssetStateCommitHash(`0x${ual}`).call();
        if (assertionId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            assertionId = undefined;
        } else {
            assertionId = assertionId.slice(2);
        }
        return { issuer, assertionId };
    }

    async getAssertionRegistryAddress() {
        const contractAddress = this.config.hubContractAddress;
        const contractInstance = new this.web3.eth.Contract(UAIRegistry, contractAddress);

        const address = await contractInstance.methods.getAssertionRegistry().call();
        return address;
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
