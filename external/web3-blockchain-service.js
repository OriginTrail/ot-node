const Web3 = require('web3');
const BigNumber = require('big-number');
const axios = require('axios');
const DKGContract = require('../build/contracts/DKGcontract.json').abi;
const UAIRegistry = require('../build/contracts/UAIRegistry.json').abi;
const constants = require('../modules/constants');

class Web3BlockchainService {
    constructor(config) {
        this.config = config;
        this.gasStationLink = 'https://gasstation-mumbai.matic.today/';
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
        const response = await axios.get(this.gasStationLink)
            .catch((err) => {
                this.logger.warn(err);
                return undefined;
            });
        if (response) {
            return response.data.standard * 1000000000;
        }
        return undefined;
    }

    async createAssertionRecord(stateCommitHash, rootHash, issuer) {
        const contractAddress = await this.getAssertionRegistryAddress();
        const contractInstance = new this.web3.eth.Contract(DKGContract, contractAddress);

        let calculatedGas = await this.getGasStationPrice();
        calculatedGas = Math.round(calculatedGas);

        const encodedABI = contractInstance.methods.createAssertionRecord(`0x${stateCommitHash}`, `0x${rootHash}`, issuer,
            new BigNumber(1),
            new BigNumber(1)).encodeABI();
        const tx = {
            from: this.config.publicKey,
            to: contractInstance.options.address,
            data: encodedABI,
            gasPrice: '20000000000',
            gas: '500000',
        };

        const createdTransaction = await this.web3.eth.accounts.signTransaction(
            tx,
            this.config.privateKey,
        );
        const result = await this.web3.eth.sendSignedTransaction(createdTransaction.rawTransaction);
        return { transactionHash: result.transactionHash, blockchain: this.config.networkId };
    }

    async registerAsset(uai, type, alsoKnownAs, stateCommitHash, rootHash, tokenAmount) {
        const contractAddress = this.config.hubContractAddress;
        const contractInstance = new this.web3.eth.Contract(UAIRegistry, contractAddress);

        let calculatedGas = await this.getGasStationPrice();
        calculatedGas = Math.round(calculatedGas);

        const encodedABI = contractInstance.methods.registerAsset(`0x${uai}`, 0, `0x${uai}`, `0x${stateCommitHash}`, `0x${rootHash}`, 1).encodeABI();
        const tx = {
            from: this.config.publicKey,
            to: contractInstance.options.address,
            data: encodedABI,
            gasPrice: '20000000000',
            gas: '900000',
        };

        const createdTransaction = await this.web3.eth.accounts.signTransaction(
            tx,
            this.config.privateKey,
        );
        const result = await this.web3.eth.sendSignedTransaction(createdTransaction.rawTransaction);
        return { transactionHash: result.transactionHash, blockchain: this.config.networkId };
    }

    async updateAsset(UAI, newStateCommitHash, rootHash) {
        const contractAddress = this.config.hubContractAddress;
        const contractInstance = new this.web3.eth.Contract(UAIRegistry, contractAddress);

        let calculatedGas = await this.getGasStationPrice();
        calculatedGas = Math.round(calculatedGas);

        const encodedABI = contractInstance.methods.updateAssetState(`0x${UAI}`, `0x${newStateCommitHash}`, `0x${rootHash}`).encodeABI();
        const tx = {
            from: this.config.publicKey,
            to: contractInstance.options.address,
            data: encodedABI,
            gasPrice: '20000000000',
            gas: '500000',
        };

        const createdTransaction = await this.web3.eth.accounts.signTransaction(
            tx,
            this.config.privateKey,
        );
        const result = await this.web3.eth.sendSignedTransaction(createdTransaction.rawTransaction);
        return { transactionHash: result.transactionHash, blockchain: this.config.networkId };
    }

    async getAssertionProofs(assertionId) {
        const contractAddress = await this.getAssertionRegistryAddress();
        const contractInstance = new this.web3.eth.Contract(DKGContract, contractAddress);

        const issuer = await contractInstance.methods.getAssertionIssuer(`0x${assertionId}`).call();
        const rootHash = await contractInstance.methods.getAssertionRootHash(`0x${assertionId}`).call();
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
