const Web3 = require('web3');
const axios = require('axios');
const { peerId2Hash } = require('assertion-tools');
const Hub = require('../../../../build/contracts/Hub.json');
const AssetRegistry = require('../../../../build/contracts/AssetRegistry.json');
const ERC20Token = require('../../../../build/contracts/ERC20Token.json');
const Identity = require('../../../../build/contracts/Identity.json');
const Profile = require('../../../../build/contracts/Profile.json');
const ProfileStorage = require('../../../../build/contracts/ProfileStorage.json');
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
        // TODO encapsulate in a generic function
        this.logger.info(`Hub contract address is ${this.config.hubContractAddress}`);
        this.hubContract = new this.web3.eth.Contract(Hub.abi, this.config.hubContractAddress);

        const assetRegistryAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['AssetRegistry'],
        );
        this.AssetRegistryContract = new this.web3.eth.Contract(AssetRegistry.abi, assetRegistryAddress);

        const tokenAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['Token'],
        );
        this.TokenContract = new this.web3.eth.Contract(ERC20Token.abi, tokenAddress);

        const profileAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['Profile'],
        );
        this.ProfileContract = new this.web3.eth.Contract(Profile.abi, profileAddress);

        const profileStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ProfileStorage'],
        );
        this.ProfileStorageContract = new this.web3.eth.Contract(ProfileStorage.abi, profileStorageAddress);

        if (this.identityExists()) {
            this.identityContract = new this.web3.eth.Contract(
                Identity.abi,
                this.getIdentity(),
            );
        }

        this.logger.debug(
            `Connected to blockchain rpc : ${this.config.rpcEndpoints[this.rpcNumber]}.`,
        );

        const nativeBalance = await this.web3.eth.getBalance(this.getPublicKey());
        const tokenBalance = await this.callContractFunction(this.TokenContract, 'balanceOf', [
            this.getPublicKey(),
        ]);
        this.logger.info(
            `Balance of ${this.getPublicKey()} is ${nativeBalance} ETH and ${tokenBalance} TRAC.`,
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

    // TODO get from blockchain
    getBlockTime() {
        return this.config.blockTime;
    }

    async deployIdentity() {
        const transactionReceipt = await this.deployContract(Identity, [
            this.getPublicKey(),
            this.getManagementKey(),
        ]);
        this.config.identity = transactionReceipt.contractAddress;
    }

    async createProfile(peerId) {
        await this.executeContractFunction(this.TokenContract, 'increaseAllowance', [
            this.ProfileContract.options.address,
            constants.INIT_STAKE_AMOUNT
        ]);

        await new Promise(resolve => setTimeout(resolve, 15000));

        const nodeId = await peerId2Hash(peerId);
        await this.executeContractFunction(this.ProfileContract, 'createProfile', [
            this.getManagementKey(),
            nodeId,
            constants.INIT_STAKE_AMOUNT,
            this.getIdentity(),
        ]);
    }

    getEpochs (UAI) {
        return this.callContractFunction(this.AssetRegistryContract, 'getEpochs', [UAI]);
    }

    async getChallenge (UAI, epoch) {
        return this.callContractFunction(this.AssetRegistryContract, 'getChallenge', [UAI, epoch, this.getIdentity()]);
    }

    async answerChallenge (UAI, epoch, proof, leaf, price) {
        return this.executeContractFunction(this.AssetRegistryContract, 'answerChallenge', [UAI, epoch, proof, leaf, price, this.getIdentity()]);
    }

    async getReward (UAI, epoch) {
        return this.executeContractFunction(this.AssetRegistryContract, 'getReward', [UAI, epoch, this.getIdentity()]);
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

                const gasLimit = await contractInstance
                    .deploy({
                        data: contract.bytecode,
                        arguments: args,
                    })
                    .estimateGas({
                        from: this.config.publicKey,
                    });

                const encodedABI = contractInstance
                    .deploy({
                        data: contract.bytecode,
                        arguments: args,
                    })
                    .encodeABI();

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

    async getLatestCommitHash(blockchain, contract, tokenId) {
        const assertionId = await this.callContractFunction(this.AssetRegistryContract, 'getCommitHash', [
            tokenId, 0
        ]);

        return assertionId;
    }

    async healthCheck() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            if (gasPrice) return true;
        } catch (e) {
            this.logger.error(`Error on checking blockchain. ${e}`);
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
