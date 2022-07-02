const Web3 = require('web3');
const BigNumber = require('bn.js');
const axios = require('axios');
const {sha256} = require('multiformats/hashes/sha2');
const sha3 = require("js-sha3");
const Hub = require('../../../../build/contracts/Hub.json');
const UAIRegistry = require('../../../../build/contracts/UAIRegistry.json');
const Identity = require('../../../../build/contracts/Identity.json');
const Profile = require('../../../../build/contracts/Profile.json');
const constants = require('../../../constants/constants');

class Web3Service {
    getName() {
        return 'Web3';
    }

    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.gasStationLink = 'https://gasstation-mumbai.matic.today/v2';
        this.rpcNumber = 0;
        await this.initializeWeb3();
        await this.initializeContracts();
    }

    async initializeWeb3() {
        let tries = 0;
        let isRpcConnected = false;
        while (!isRpcConnected) {
            if (tries >= this.config.rpcEndpoints.length) {
                throw Error('Blockchain initialisation failed');
            }

            try {
                this.web3 = new Web3(this.config.rpcEndpoints[this.rpcNumber]);
                isRpcConnected = await this.web3.eth.net.isListening();
            } catch (e) {
                this.logger.warn(
                    `Unable to connect to blockchain rpc : ${
                        this.config.rpcEndpoints[this.rpcNumber]
                    }.`,
                );
                tries += 1;
                this.rpcNumber = (this.rpcNumber + 1) % this.config.rpcEndpoints.length;
            }
        }
    }

    async initializeContracts() {
        this.hubContract = new this.web3.eth.Contract(
            Hub.abi,
            this.config.hubContractAddress,
        );

        const UAIRegistryAddress = await this.callContractFunction(this.hubContract, 'getContractAddress', ['UAIRegistry']);
        this.UAIRegistryContract = new this.web3.eth.Contract(
            UAIRegistry.abi,
            UAIRegistryAddress,
        );

        const profileAddress = await this.callContractFunction(this.hubContract, 'getContractAddress', ['Profile']);
        this.profileContract = new this.web3.eth.Contract(
            Profile.abi,
            profileAddress,
        );

        if (this.identityExists()) {
            this.identityContract = new this.web3.eth.Contract(
                Identity.abi,
                this.getIdentity(),
            );
        }

        this.logger.debug(
            `Connected to blockchain rpc : ${this.config.rpcEndpoints[this.rpcNumber]}.`,
        );
    }

    identityExists() {
        return this.config.identity != null;
    }

    getIdentity() {
        return this.config.identity;
    }

    getBlockNumber() {
        return this.web3.eth.getBlockNumber();
    }

    getBlockTime() {
        return this.config.blockTime;
    }

    async deployIdentity() {
        const parameters = this.web3.eth.abi.encodeParameters(
            ['address', 'address'],
            [this.getPublicKey(), this.getManagementKey()],
        ).slice(2);

        const createTransaction = await this.web3.eth.accounts.signTransaction({
            from: this.getPublicKey(),
            data: `${Identity.bytecode}${parameters}`,
            value: '0x00',
            gasPrice: this.web3.utils.toWei('100', 'Gwei'),
            gas: this.web3.utils.toWei('9000', 'Kwei'),
        }, this.getPrivateKey());

        const createReceipt =
            await this.web3.eth.sendSignedTransaction(createTransaction.rawTransaction);
        this.config.identity = createReceipt.contractAddress;
        return createReceipt.contractAddress;
        // const transactionReceipt = await this.deployContract(Identity, [this.getPublicKey(), this.getManagementKey()]);
        // this.config.identity = transactionReceipt.contractAddress;
    }

    async createProfile(peerId) {
        const nodeId = Buffer.from((await sha256.digest(peerId.toBytes())).digest).toString('hex');
        await this.executeContractFunction(this.profileContract, 'createProfile', [this.getManagementKey(),
            `0x${nodeId}`,
            0,
            this.getIdentity()]);
    }

    getEpochs (UAI) {
        return this.callContractFunction(this.UAIRegistryContract, 'getEpochs', [UAI]);
    }

    async getChallenge (UAI, epoch) {
        let res = await this.callContractFunction(this.identityContract, 'getKey', [`0x${sha3.keccak256(this.web3.utils.encodePacked(this.getPublicKey()))}`]);
        res = await this.callContractFunction(this.identityContract, 'getKey', [this.getManagementKey()]);

        const test = await this.callContractFunction(this.UAIRegistryContract, 'getAssetStateCommitHash', [UAI]);
        return this.callContractFunction(this.UAIRegistryContract, 'getChallenge', [UAI, epoch, this.getIdentity()]);
    }

    async answerChallenge (UAI, epoch, proof, leaf, price) {
        return this.executeContractFunction(this.UAIRegistryContract, 'answerChallenge', [UAI, epoch, proof, leaf, price, this.getIdentity()]);
    }

    async getReward (UAI, epoch) {
        return this.executeContractFunction(this.UAIRegistryContract, 'getReward', [UAI, epoch, this.getIdentity()]);
    }

    getPrivateKey() {
        return this.config.privateKey;
    }

    getPublicKey() {
        return this.config.publicKey;
    }

    getManagementKey() {
        return this.config.managementKey;
    }

    async getGasStationPrice() {
        const response = await axios.get(this.gasStationLink).catch((err) => {
            this.logger.warn(err);
            return undefined;
        });
        try {
            return Math.round(response.data.standard.maxFee * 1e9);
        } catch (e) {
            return undefined;
        }
    }

    async callContractFunction(contractInstance, functionName, args) {
        let result;
        while (!result) {
            try {
                result = await contractInstance.methods[functionName](...args).call();
            } catch (error) {
                await this.handleError(error, functionName);
            }
        }

        return result;
    }

    async executeContractFunction(contractInstance, functionName, args) {
        let result;
        while (!result) {
            try {
                const gasPrice = await this.getGasStationPrice();

                const gasLimit = await contractInstance.methods[functionName](...args).estimateGas({
                    from: this.config.publicKey,
                });

                const encodedABI = contractInstance.methods[functionName](...args).encodeABI();
                const tx = {
                    from: this.config.publicKey,
                    to: contractInstance.options.address,
                    data: encodedABI,
                    gasPrice: this.web3.utils.toWei('100', 'Gwei'),
                    gas: gasLimit || this.web3.utils.toWei('900', 'Kwei'),
                };

                const createdTransaction = await this.web3.eth.accounts.signTransaction(
                    tx,
                    this.config.privateKey,
                );
                result = await this.web3.eth.sendSignedTransaction(
                    createdTransaction.rawTransaction,
                );
            } catch (error) {
                await this.handleError(error, functionName);
            }
        }

        return result;
    }

    async deployContract(contract, args) {
        let result;
        while (!result) {
            try {
                const contractInstance = new this.web3.eth.Contract(contract.abi);
                const gasPrice = await this.getGasStationPrice();

                const gasLimit = await contractInstance.deploy({
                    data: contract.bytecode,
                    arguments: args,
                }).estimateGas({
                    from: this.config.publicKey,
                });

                const encodedABI = contractInstance.deploy({
                    data: contract.bytecode,
                    arguments: args,
                }).encodeABI();

                const tx = {
                    from: this.config.publicKey,
                    data: encodedABI,
                    gasPrice: gasPrice || this.web3.utils.toWei('20', 'Gwei'),
                    gas: gasLimit || this.web3.utils.toWei('900', 'Kwei'),
                };

                const createdTransaction = await this.web3.eth.accounts.signTransaction(
                    tx,
                    this.config.privateKey,
                );
                result = await this.web3.eth.sendSignedTransaction(
                    createdTransaction.rawTransaction,
                );
            } catch (error) {
                await this.handleError(error, 'deploy');
            }
        }

        return result;
    }

    async createAssertionRecord(stateCommitHash, rootHash, issuer) {
        const result = await this.executeContractFunction(
            this.DKGContract,
            'createAssertionRecord',
            [`0x${stateCommitHash}`, `0x${rootHash}`, issuer, new BigNumber(1), new BigNumber(1)],
        );
        return {transactionHash: result.transactionHash, blockchain: this.config.networkId};
    }

    async registerAsset(uai, type, alsoKnownAs, stateCommitHash, rootHash, tokenAmount) {
        const result = await this.executeContractFunction(
            this.UAIRegistryContract,
            'registerAsset',
            [`0x${uai}`, 0, `0x${uai}`, `0x${stateCommitHash}`, `0x${rootHash}`, 1],
        );
        return {transactionHash: result.transactionHash, blockchain: this.config.networkId};
    }

    async updateAsset(UAI, newStateCommitHash, rootHash) {
        const result = await this.executeContractFunction(
            this.UAIRegistryContract,
            'updateAssetState',
            [`0x${UAI}`, `0x${newStateCommitHash}`, `0x${rootHash}`],
        );
        return {transactionHash: result.transactionHash, blockchain: this.config.networkId};
    }

    async getAssertionProofs(assertionId) {
        const issuer = await this.callContractFunction(this.DKGContract, 'getAssertionIssuer', [
            `0x${assertionId}`,
        ]);
        const rootHash = await this.callContractFunction(this.DKGContract, 'getAssertionRootHash', [
            `0x${assertionId}`,
        ]);
        return {issuer, rootHash};
    }

    async getAssetProofs(blockchain, contract, tokenId) {
        const issuer = await this.callContractFunction(
            this.UAIRegistryContract,
            'getAssetOwner',
            [tokenId],
        );
        let assertionId = await this.callContractFunction(
            this.UAIRegistryContract,
            'getAssetStateCommitHash',
            [tokenId],
        );
        if (assertionId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            assertionId = undefined;
        } else {
            assertionId = assertionId.slice(2);
        }
        return {issuer, assertionId};
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

    async handleError(error, functionName) {
        let isRpcError = false;
        try {
            await this.web3.eth.net.isListening();
        } catch (rpcError) {
            isRpcError = true;
            this.logger.warn(
                `Unable to execute smart contract function ${functionName} using blockchain rpc : ${
                    this.config.rpcEndpoints[this.rpcNumber]
                }.`,
            );
            await this.restartService();
        }
        if (!isRpcError) throw error;
    }

    async restartService() {
        this.rpcNumber = (this.rpcNumber + 1) % this.config.rpcEndpoints.length;
        this.logger.warn(
            `There was an issue with current blockchain rpc. Connecting to ${
                this.config.rpcEndpoints[this.rpcNumber]
            }`,
        );
        await this.initializeWeb3();
        await this.initializeContracts();
    }
}

module.exports = Web3Service;
