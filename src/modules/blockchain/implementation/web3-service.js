import { ethers, BigNumber } from 'ethers';
import Web3 from 'web3';
import axios from 'axios';
import async from 'async';
import { setTimeout as sleep } from 'timers/promises';
import { createRequire } from 'module';

import {
    DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS,
    INIT_ASK_AMOUNT,
    INIT_STAKE_AMOUNT,
    MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH,
    TRANSACTION_POLLING_TIMEOUT,
    TRANSACTION_QUEUE_CONCURRENCY,
    WEBSOCKET_PROVIDER_OPTIONS,
} from '../../../constants/constants.js';

const require = createRequire(import.meta.url);
const AssertionRegistry = require('dkg-evm-module/build/contracts/AssertionRegistry.json');
const ContentAsset = require('dkg-evm-module/build/contracts/ContentAsset.json');
const ERC20Token = require('dkg-evm-module/build/contracts/ERC20Token.json');
const HashingProxy = require('dkg-evm-module/build/contracts/HashingProxy.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const Log2PLDSF = require('dkg-evm-module/build/contracts/Log2PLDSF.json');
const ParametersStorage = require('dkg-evm-module/build/contracts/ParametersStorage.json');
const Profile = require('dkg-evm-module/build/contracts/Profile.json');
const ProfileStorage = require('dkg-evm-module/build/contracts/ProfileStorage.json');
const ScoringProxy = require('dkg-evm-module/build/contracts/ScoringProxy.json');
const ServiceAgreementStorage = require('dkg-evm-module/build/contracts/ServiceAgreementStorage.json');
const ShardingTable = require('dkg-evm-module/build/contracts/ShardingTable.json');

const FIXED_GAS_LIMIT_METHODS = ['submitCommit', 'sendProof'];

const COMMIT_PROOF_GAS_LIMIT = 300000;

class Web3Service {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.rpcNumber = 0;
        this.initializeTransactionQueue(TRANSACTION_QUEUE_CONCURRENCY);
        await this.initializeWeb3();
        this.currentBlock = await this.web3.eth.getBlockNumber();
        await this.initializeContracts();
    }

    initializeTransactionQueue(concurrency) {
        this.transactionQueue = async.queue(async (args, cb) => {
            const { contractInstance, functionName, transactionArgs, future } = args;
            try {
                const result = this._executeContractFunction(
                    contractInstance,
                    functionName,
                    transactionArgs,
                );
                future.resolve(result);
            } catch (error) {
                future.revert(error);
            }
            cb();
        }, concurrency);
    }

    async queueTransaction(contractInstance, functionName, transactionArgs) {
        return new Promise((resolve, reject) => {
            this.transactionQueue.push({
                contractInstance,
                functionName,
                transactionArgs,
                future: {
                    resolve,
                    reject,
                },
            });
        });
    }

    async initializeWeb3() {
        let tries = 0;
        let isRpcConnected = false;
        while (!isRpcConnected) {
            if (tries >= this.config.rpcEndpoints.length) {
                throw Error('RPC initialization failed');
            }

            try {
                if (this.config.rpcEndpoints[this.rpcNumber].startsWith('ws')) {
                    const provider = new Web3.providers.WebsocketProvider(
                        this.config.rpcEndpoints[this.rpcNumber],
                        WEBSOCKET_PROVIDER_OPTIONS,
                    );
                    this.web3 = new Web3(provider);
                } else {
                    this.web3 = new Web3(this.config.rpcEndpoints[this.rpcNumber]);
                    this.web3.eth.transactionPollingTimeout = TRANSACTION_POLLING_TIMEOUT;
                }
                // eslint-disable-next-line no-await-in-loop
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
        this.logger.info(
            `Initializing contracts with hub contract address: ${this.config.hubContractAddress}`,
        );
        this.hubContract = new this.web3.eth.Contract(Hub.abi, this.config.hubContractAddress);

        const parametersStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ParametersStorage'],
        );
        this.ParametersStorageContract = new this.web3.eth.Contract(
            ParametersStorage.abi,
            parametersStorageAddress,
        );

        const hashingProxyAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['HashingProxy'],
        );
        this.HashingProxyContract = new this.web3.eth.Contract(
            HashingProxy.abi,
            hashingProxyAddress,
        );

        const shardingTableAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ShardingTable'],
        );
        this.ShardingTableContract = new this.web3.eth.Contract(
            ShardingTable.abi,
            shardingTableAddress,
        );

        const assertionRegistryAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['AssertionRegistry'],
        );
        this.AssertionRegistryContract = new this.web3.eth.Contract(
            AssertionRegistry.abi,
            assertionRegistryAddress,
        );

        const contentAssetAddress = await this.callContractFunction(
            this.hubContract,
            'getAssetContractAddress',
            ['ContentAsset'],
        );
        this.ContentAssetContract = new this.web3.eth.Contract(
            ContentAsset.abi,
            contentAssetAddress,
        );

        const tokenAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['Token'],
        );
        this.TokenContract = new this.web3.eth.Contract(ERC20Token.abi, tokenAddress);

        const identityStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['IdentityStorage'],
        );
        this.IdentityStorageContract = new this.web3.eth.Contract(
            IdentityStorage.abi,
            identityStorageAddress,
        );

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
        this.ProfileStorageContract = new this.web3.eth.Contract(
            ProfileStorage.abi,
            profileStorageAddress,
        );

        const serviceAgreementStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ServiceAgreementStorage'],
        );
        this.ServiceAgreementStorageContract = new this.web3.eth.Contract(
            ServiceAgreementStorage.abi,
            serviceAgreementStorageAddress,
        );

        const scoringProxyAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ScoringProxy'],
        );
        this.ScoringProxyContract = new this.web3.eth.Contract(
            ScoringProxy.abi,
            scoringProxyAddress,
        );

        const log2PLDSFAddress = await this.callContractFunction(
            this.ScoringProxyContract,
            'functions',
            [0],
        );
        this.Log2PLDSFContract = new this.web3.eth.Contract(Log2PLDSF.abi, log2PLDSFAddress);

        // TODO: Change this nonsense
        this.assetContracts = {
            [contentAssetAddress.toLowerCase()]: this.ContentAssetContract,
        };
        this.logger.info(`Contracts initialized`);
        this.logger.debug(
            `Connected to blockchain rpc : ${this.config.rpcEndpoints[this.rpcNumber]}.`,
        );

        await this.logBalances();
    }

    getPrivateKey() {
        return this.config.evmOperationalWalletPrivateKey;
    }

    getPublicKey() {
        return this.config.evmOperationalWalletPublicKey;
    }

    getManagementKey() {
        return this.config.evmManagementWalletPublicKey;
    }

    async logBalances() {
        const nativeBalance = await this.getNativeTokenBalance();
        const tokenBalance = await this.getTokenBalance();
        this.logger.info(
            `Balance of ${this.getPublicKey()} is ${nativeBalance} ${
                this.baseTokenTicker
            } and ${tokenBalance} ${this.tracTicker}.`,
        );
    }

    async getNativeTokenBalance() {
        const nativeBalance = await this.web3.eth.getBalance(this.getPublicKey());
        return Number(this.web3.utils.fromWei(nativeBalance));
    }

    async getTokenBalance() {
        const tokenBalance = await this.callContractFunction(this.TokenContract, 'balanceOf', [
            this.getPublicKey(),
        ]);
        return Number(this.web3.utils.fromWei(tokenBalance));
    }

    async getBlockNumber() {
        return this.web3.eth.getBlockNumber();
    }

    async getIdentityId() {
        if (this.config.identityId) {
            return this.config.identityId;
        }
        const identityId = await this.callContractFunction(
            this.IdentityStorageContract,
            'getIdentityId',
            [this.getPublicKey()],
        );
        this.config.identityId = Number(identityId);
        return this.config.identityId;
    }

    async identityIdExists() {
        const identityId = await this.getIdentityId();

        return identityId != null && identityId !== 0;
    }

    async createProfile(peerId) {
        const initialAsk = this.convertToWei(INIT_ASK_AMOUNT);
        const initialStake = this.convertToWei(INIT_STAKE_AMOUNT);

        await this.queueTransaction(this.TokenContract, 'increaseAllowance', [
            this.ProfileContract.options.address,
            initialStake,
        ]);

        const maxNumberOfRetries = 3;
        let retryCount = 0;
        let profileCreated = false;
        const retryDelayInSec = 5;
        while (retryCount + 1 <= maxNumberOfRetries && !profileCreated) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await this.queueTransaction(this.ProfileContract, 'createProfile', [
                    this.getManagementKey(),
                    this.convertAsciiToHex(peerId),
                    initialAsk,
                    initialStake,
                ]);
                profileCreated = true;
            } catch (error) {
                if (error.message.includes('Profile already exists')) {
                    this.logger.info(`Skipping profile creation, already exists on blockchain.`);
                    profileCreated = true;
                } else if (retryCount + 1 < maxNumberOfRetries) {
                    retryCount += 1;
                    this.logger.warn(
                        `Unable to create profile. Will retry in ${retryDelayInSec}s. Retries left: ${
                            maxNumberOfRetries - retryCount
                        }`,
                    );
                    // eslint-disable-next-line no-await-in-loop
                    await sleep(retryDelayInSec * 1000);
                } else {
                    // eslint-disable-next-line no-await-in-loop
                    await this.queueTransaction(this.TokenContract, 'decreaseAllowance', [
                        this.ProfileContract.options.address,
                        initialStake,
                    ]);
                    throw error;
                }
            }
        }
    }

    async getGasPrice() {
        try {
            const response = await axios.get(this.config.gasPriceOracleLink);
            const gasPriceRounded = Math.round(response.data.standard.maxFee * 1e9);
            return gasPriceRounded;
        } catch (error) {
            return undefined;
        }
    }

    async callContractFunction(contractInstance, functionName, args) {
        let result;
        while (result === undefined) {
            try {
                // eslint-disable-next-line no-await-in-loop
                result = await contractInstance.methods[functionName](...args).call();
            } catch (error) {
                // eslint-disable-next-line no-await-in-loop
                await this.handleError(error, functionName);
            }
        }

        return result;
    }

    async _executeContractFunction(contractInstance, functionName, args) {
        let result;
        let gasPrice = (await this.getGasPrice()) || this.convertToWei(20, 'Gwei');
        let transactionRetried = false;
        while (result === undefined) {
            try {
                /* eslint-disable no-await-in-loop */
                let gasLimit;

                if (FIXED_GAS_LIMIT_METHODS.includes(functionName)) {
                    gasLimit = COMMIT_PROOF_GAS_LIMIT;
                } else {
                    gasLimit = await contractInstance.methods[functionName](...args).estimateGas({
                        from: this.getPublicKey(),
                    });
                }

                const encodedABI = contractInstance.methods[functionName](...args).encodeABI();
                const gas = gasLimit || this.convertToWei(900, 'Kwei');
                const tx = {
                    from: this.getPublicKey(),
                    to: contractInstance.options.address,
                    data: encodedABI,
                    gasPrice,
                    gas,
                };

                const createdTransaction = await this.web3.eth.accounts.signTransaction(
                    tx,
                    this.getPrivateKey(),
                );
                this.logger.info(
                    `Sending transaction to blockchain, calling method: ${functionName} with gas limit: ${gas.toString()} and gasPrice ${gasPrice.toString()}`,
                );
                result = await this.web3.eth.sendSignedTransaction(
                    createdTransaction.rawTransaction,
                );
            } catch (error) {
                if (
                    !transactionRetried &&
                    error.message.includes(`Transaction was not mined within`)
                ) {
                    this.logger.warn(
                        `Transaction was not mined within ${TRANSACTION_POLLING_TIMEOUT} seconds. Retrying transaction with new gas price`,
                    );
                    gasPrice *= 1.2;
                    transactionRetried = true;
                } else {
                    await this.handleError(error, functionName);
                }
            }
        }

        return result;
    }

    async getAllPastEvents(
        contractName,
        onEventsReceived,
        getLastCheckedBlock,
        updateLastCheckedBlock,
    ) {
        const contract = this[contractName];
        if (!contract) {
            throw Error(`Error while getting all past events. Unknown contract: ${contractName}`);
        }

        const blockchainId = this.getBlockchainId();
        const lastCheckedBlockObject = await getLastCheckedBlock(blockchainId, contractName);

        let fromBlock;

        if (
            this.isOlderThan(
                lastCheckedBlockObject?.last_checked_timestamp,
                DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS,
            )
        ) {
            fromBlock = this.currentBlock - 10;
        } else {
            this.currentBlock = await this.getBlockNumber();
            fromBlock = lastCheckedBlockObject.last_checked_block + 1;
        }

        let events = [];
        if (this.currentBlock - fromBlock > MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH) {
            let iteration = 1;

            while (fromBlock - MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH > this.currentBlock) {
                events.concat(
                    await contract.getPastEvents('allEvents', {
                        fromBlock,
                        toBlock: fromBlock + MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH * iteration,
                    }),
                );
                fromBlock += MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH * iteration;
                iteration += 1;
            }
        } else {
            events = await contract.getPastEvents('allEvents', {
                fromBlock,
                toBlock: this.currentBlock,
            });
        }

        await updateLastCheckedBlock(blockchainId, this.currentBlock, Date.now(), contractName);
        if (events.length > 0) {
            await onEventsReceived(
                events.map((event) => ({
                    contract: contractName,
                    event: event.event,
                    data: JSON.stringify(event.returnValues),
                    block: event.blockNumber,
                    blockchainId,
                })),
            );
        }
    }

    isOlderThan(timestamp, olderThanInMills) {
        if (!timestamp) return true;
        const timestampThirtyDaysInPast = new Date().getTime() - olderThanInMills;
        return timestamp < timestampThirtyDaysInPast;
    }

    async deployContract(contract, args) {
        let result;
        while (!result) {
            try {
                const contractInstance = new this.web3.eth.Contract(contract.abi);
                const gasPrice = await this.getGasPrice();

                const gasLimit = await contractInstance
                    .deploy({
                        data: contract.bytecode,
                        arguments: args,
                    })
                    .estimateGas({
                        from: this.getPublicKey(),
                    });

                const encodedABI = contractInstance
                    .deploy({
                        data: contract.bytecode,
                        arguments: args,
                    })
                    .encodeABI();

                const tx = {
                    from: this.getPublicKey(),
                    data: encodedABI,
                    gasPrice: gasPrice ?? this.convertToWei(20, 'Gwei'),
                    gas: gasLimit ?? this.convertToWei(900, 'Kwei'),
                };

                const createdTransaction = await this.web3.eth.accounts.signTransaction(
                    tx,
                    this.getPrivateKey(),
                );

                return this.web3.eth.sendSignedTransaction(createdTransaction.rawTransaction);
            } catch (error) {
                await this.handleError(error, 'deploy');
            }
        }

        return result;
    }

    async getAssertionsLength(assetContractAddress, tokenId) {
        const assertionsLength = await this.callContractFunction(
            this.assetContracts[assetContractAddress.toLowerCase()], // TODO: Change this nonsense
            'getAssertionsLength',
            [tokenId],
        );
        return Number(assertionsLength);
    }

    async getAssertionByIndex(assetContractAddress, tokenId, index) {
        return this.callContractFunction(
            this.assetContracts[assetContractAddress.toLowerCase()], // TODO: Change this nonsense
            'getAssertionByIndex',
            [tokenId, index],
        );
    }

    async getLatestAssertion(assetContractAddress, tokenId) {
        return this.callContractFunction(
            this.assetContracts[assetContractAddress.toLowerCase()], // TODO: Change this nonsense
            'getLatestAssertion',
            [tokenId],
        );
    }

    async getAssertionIssuer(assertionId) {
        return this.callContractFunction(this.AssertionRegistryContract, 'getIssuer', [
            assertionId,
        ]);
    }

    async getAgreementData(agreementId) {
        const result = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getAgreementData',
            [agreementId],
        );

        const agreementData = {};
        agreementData.startTime = Number(result['0']);
        agreementData.epochsNumber = Number(result['1']);
        agreementData.epochLength = Number(result['2']);
        agreementData.tokenAmount = Number(result['3']);
        agreementData.scoreFunctionId = Number(result['4']);
        agreementData.proofWindowOffsetPerc = Number(result['5']);

        return agreementData;
    }

    async getAssertionSize(assertionId) {
        const size = await this.callContractFunction(this.AssertionRegistryContract, 'getSize', [
            assertionId,
        ]);

        return Number(size);
    }

    async getAssertionTriplesNumber(assertionId) {
        const triplesNumber = await this.callContractFunction(
            this.AssertionRegistryContract,
            'getTriplesNumber',
            [assertionId],
        );

        return Number(triplesNumber);
    }

    async getAssertionChunksNumber(assertionId) {
        const chunksNumber = await this.callContractFunction(
            this.AssertionRegistryContract,
            'getChunksNumber',
            [assertionId],
        );

        return Number(chunksNumber);
    }

    async getAgreementStartTime(agreementId) {
        const startTime = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getAgreementStartTime',
            [agreementId],
        );
        return Number(startTime);
    }

    async getAgreementEpochsNumber(agreementId) {
        const epochsNumber = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getAgreementEpochsNumber',
            [agreementId],
        );
        return Number(epochsNumber);
    }

    async getAgreementEpochLength(agreementId) {
        const epochLength = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getAgreementEpochLength',
            [agreementId],
        );
        return Number(epochLength);
    }

    async getAgreementTokenAmount(agreementId) {
        const tokenAmount = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getAgreementTokenAmount',
            [agreementId],
        );
        return Number(tokenAmount);
    }

    async getAgreementScoreFunctionId(agreementId) {
        const scoreFunctionId = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getAgreementScoreFunctionId',
            [agreementId],
        );
        return Number(scoreFunctionId);
    }

    async getAgreementProofWindowOffsetPerc(agreementId) {
        const proofWindowOffsetPerc = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getAgreementProofWindowOffsetPerc',
            [agreementId],
        );
        return Number(proofWindowOffsetPerc);
    }

    async isCommitWindowOpen(agreementId, epoch) {
        return this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'isCommitWindowOpen',
            [agreementId, epoch],
        );
    }

    async getCommitSubmissions(agreementId, epoch) {
        const commits = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getCommitSubmissions',
            [agreementId, epoch],
        );

        return commits
            .filter((commit) => commit.identityId !== '0')
            .map((commit) => ({
                identityId: Number(commit.identityId),
                nextIdentityId: Number(commit.nextIdentityId),
                score: Number(commit.score),
            }));
    }

    async getHashFunctionName(hashFunctionId) {
        return this.callContractFunction(this.HashingProxyContract, 'getHashFunctionName', [
            hashFunctionId,
        ]);
    }

    async callHashFunction(hashFunctionId, data) {
        return this.callContractFunction(this.HashingProxyContract, 'callHashFunction', [
            hashFunctionId,
            data,
        ]);
    }

    async getR2() {
        const R2 = await this.callContractFunction(this.ParametersStorageContract, 'R2', []);
        return Number(R2);
    }

    async getR1() {
        const R1 = await this.callContractFunction(this.ParametersStorageContract, 'R1', []);
        return Number(R1);
    }

    async getR0() {
        const R0 = await this.callContractFunction(this.ParametersStorageContract, 'R0', []);
        return Number(R0);
    }

    async submitCommit(assetContractAddress, tokenId, keyword, hashFunctionId, epoch) {
        return this.queueTransaction(this.ServiceAgreementStorageContract, 'submitCommit', [
            assetContractAddress,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
        ]);
    }

    async isProofWindowOpen(agreementId, epoch) {
        return this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'isProofWindowOpen',
            [agreementId, epoch],
        );
    }

    async getChallenge(assetContractAddress, tokenId, epoch) {
        const challengeDict = await this.callContractFunction(
            this.ServiceAgreementStorageContract,
            'getChallenge',
            [this.getPublicKey(), assetContractAddress, tokenId, epoch],
        );

        challengeDict.assertionId = challengeDict['0'];
        challengeDict.challenge = Number(challengeDict['1']);

        delete challengeDict['0'];
        delete challengeDict['1'];

        return challengeDict;
    }

    async sendProof(
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        proof,
        chunkHash,
    ) {
        return this.queueTransaction(this.ServiceAgreementStorageContract, 'sendProof', [
            assetContractAddress,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            proof,
            chunkHash,
        ]);
    }

    async getShardingTableHead() {
        return this.callContractFunction(this.ShardingTableContract, 'head', []);
    }

    async getShardingTableLength() {
        const nodesCount = await this.callContractFunction(
            this.ShardingTableContract,
            'nodesCount',
            [],
        );
        return Number(nodesCount);
    }

    async getShardingTablePage(startingPeerId, nodesNum) {
        return this.callContractFunction(this.ShardingTableContract, 'getShardingTable', [
            startingPeerId,
            nodesNum,
        ]);
    }

    async getShardingTableFull() {
        return this.callContractFunction(this.ShardingTableContract, 'getShardingTable', []);
    }

    getBlockchainId() {
        return this.getImplementationName();
    }

    convertAsciiToHex(peerId) {
        return Web3.utils.asciiToHex(peerId);
    }

    convertHexToAscii(peerIdHex) {
        return Web3.utils.hexToAscii(peerIdHex);
    }

    convertToWei(ether, fromUnit = 'ether') {
        return Web3.utils.toWei(ether.toString(), fromUnit);
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

    async getCommitWindowDuration() {
        const commitWindowDuration = await this.callContractFunction(
            this.ParametersStorageContract,
            'commitWindowDuration',
            [],
        );
        return Number(commitWindowDuration);
    }

    async getProofWindowDurationPerc() {
        const proofWindowDurationPerc = await this.callContractFunction(
            this.ParametersStorageContract,
            'proofWindowDurationPerc',
            [],
        );
        return Number(proofWindowDurationPerc);
    }

    async getLog2PLDSFParams() {
        const log2pldsfParams = await this.callContractFunction(
            this.Log2PLDSFContract,
            'getParameters',
            [],
        );

        const params = {};
        params.distanceMappingCoefficient = BigNumber.from(log2pldsfParams['0']);
        params.stakeMappingCoefficient = Number(
            ethers.utils.formatUnits(log2pldsfParams['1'], 'ether'),
        );

        const paramNames = [
            'multiplier',
            'logArgumentConstant',
            'a',
            'stakeExponent',
            'b',
            'c',
            'distanceExponent',
            'd',
        ];
        log2pldsfParams['2'].forEach((val, index) => {
            params[paramNames[index]] = Number(val);
        });

        return params;
    }
}

export default Web3Service;
