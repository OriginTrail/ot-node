import { ethers } from 'ethers';
import Web3 from 'web3';
import axios from 'axios';
import async from 'async';
import { setTimeout as sleep } from 'timers/promises';
import { createRequire } from 'module';

import {
    DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS,
    MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH,
    TRANSACTION_POLLING_TIMEOUT,
    TRANSACTION_QUEUE_CONCURRENCY,
    WEBSOCKET_PROVIDER_OPTIONS,
} from '../../../constants/constants.js';

const require = createRequire(import.meta.url);
const AbstractAsset = require('dkg-evm-module/build/contracts/AbstractAsset.json');
const AssertionStorage = require('dkg-evm-module/build/contracts/AssertionStorage.json');
const Staking = require('dkg-evm-module/build/contracts/Staking.json');
const StakingStorage = require('dkg-evm-module/build/contracts/StakingStorage.json');
const ERC20Token = require('dkg-evm-module/build/contracts/ERC20Token.json');
const HashingProxy = require('dkg-evm-module/build/contracts/HashingProxy.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const Log2PLDSF = require('dkg-evm-module/build/contracts/Log2PLDSF.json');
const ParametersStorage = require('dkg-evm-module/build/contracts/ParametersStorage.json');
const Profile = require('dkg-evm-module/build/contracts/Profile.json');
const ProfileStorage = require('dkg-evm-module/build/contracts/ProfileStorage.json');
const ScoringProxy = require('dkg-evm-module/build/contracts/ScoringProxy.json');
const ServiceAgreementStorageV1 = require('dkg-evm-module/build/contracts/ServiceAgreementStorageV1.json');
const ServiceAgreementV1 = require('dkg-evm-module/build/contracts/ServiceAgreementV1.json');
const ShardingTable = require('dkg-evm-module/build/contracts/ShardingTable.json');
const ShardingTableStorage = require('dkg-evm-module/build/contracts/ShardingTableStorage.json');

const FIXED_GAS_LIMIT_METHODS = {
    submitCommit: 300000,
    sendProof: 400000,
};

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
            const { contractInstance, functionName, transactionArgs } = args;
            try {
                const result = await this._executeContractFunction(
                    contractInstance,
                    functionName,
                    transactionArgs,
                );
                cb({ result });
            } catch (error) {
                cb({ error });
            }
        }, concurrency);
    }

    async queueTransaction(contractInstance, functionName, transactionArgs, callback) {
        this.transactionQueue.push(
            {
                contractInstance,
                functionName,
                transactionArgs,
            },
            callback,
        );
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

        const stakingContractAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['Staking'],
        );
        this.StakingContract = new this.web3.eth.Contract(Staking.abi, stakingContractAddress);

        const stakingStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['StakingStorage'],
        );
        this.StakingStorageContract = new this.web3.eth.Contract(
            StakingStorage.abi,
            stakingStorageAddress,
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

        const shardingTableStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ShardingTableStorage'],
        );
        this.ShardingTableStorageContract = new this.web3.eth.Contract(
            ShardingTableStorage.abi,
            shardingTableStorageAddress,
        );

        const assertionStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['AssertionStorage'],
        );
        this.AssertionStorageContract = new this.web3.eth.Contract(
            AssertionStorage.abi,
            assertionStorageAddress,
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

        const serviceAgreementV1Address = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ServiceAgreementV1'],
        );
        this.ServiceAgreementV1Contract = new this.web3.eth.Contract(
            ServiceAgreementV1.abi,
            serviceAgreementV1Address,
        );

        const serviceAgreementStorageV1Address = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ServiceAgreementStorageV1'],
        );
        this.ServiceAgreementStorageV1Contract = new this.web3.eth.Contract(
            ServiceAgreementStorageV1.abi,
            serviceAgreementStorageV1Address,
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
            'getScoreFunctionContractAddress',
            [1],
        );
        this.Log2PLDSFContract = new this.web3.eth.Contract(Log2PLDSF.abi, log2PLDSFAddress);

        this.assetStorageContracts = {};
        const assetStoragesArray = await this.callContractFunction(
            this.hubContract,
            'getAllAssetStorages',
            [],
        );
        assetStoragesArray.forEach((assetStorage) => {
            this.assetStorageContracts[assetStorage[1].toLowerCase()] = new this.web3.eth.Contract(
                AbstractAsset.abi,
                assetStorage[1],
            );
        });

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

        return !!identityId;
    }

    async createProfile(peerId) {
        if (!this.config.sharesTokenName || !this.config.sharesTokenSymbol) {
            throw Error(
                'Missing sharesTokenName and sharesTokenSymbol in blockchain configuration. Please add it and start the node again.',
            );
        }

        const maxNumberOfRetries = 3;
        let retryCount = 0;
        let profileCreated = false;
        const retryDelayInSec = 12;
        while (retryCount + 1 <= maxNumberOfRetries && !profileCreated) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await this._executeContractFunction(this.ProfileContract, 'createProfile', [
                    this.getManagementKey(),
                    this.convertAsciiToHex(peerId),
                    this.config.sharesTokenName,
                    this.config.sharesTokenSymbol,
                ]);
                this.logger.info(
                    `Profile created with name: ${this.config.sharesTokenName} and symbol: ${this.config.sharesTokenSymbol}`,
                );
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
        let gasPrice = (await this.getGasPrice()) ?? this.convertToWei(20, 'gwei');
        let transactionRetried = false;
        while (result === undefined) {
            try {
                /* eslint-disable no-await-in-loop */
                let gasLimit;

                if (FIXED_GAS_LIMIT_METHODS[functionName]) {
                    gasLimit = FIXED_GAS_LIMIT_METHODS[functionName];
                } else {
                    gasLimit = await contractInstance.methods[functionName](...args).estimateGas({
                        from: this.getPublicKey(),
                    });
                }

                const encodedABI = contractInstance.methods[functionName](...args).encodeABI();
                const gas = gasLimit ?? this.convertToWei(900, 'kwei');
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
                    `Sending signed transaction to blockchain with transaction hash: ${
                        createdTransaction.transactionHash
                    }, calling method: ${functionName} with gas limit: ${gas.toString()} and gasPrice ${gasPrice.toString()}`,
                );
                result = await this.web3.eth.sendSignedTransaction(
                    createdTransaction.rawTransaction,
                );
            } catch (error) {
                this.logger.warn(
                    `Failed executing smart contract function ${functionName}. Error: ${error.message}`,
                );
                if (
                    !transactionRetried &&
                    (error.message.includes(`Transaction was not mined within`) ||
                        error.message.includes(`Pool(TooLowPriority`))
                ) {
                    gasPrice *= Math.ceil(1.2);
                    this.logger.warn(
                        `Retrying to execute smart contract function ${functionName} with gasPrice: ${gasPrice}`,
                    );
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

    async isHubContract(contractAddress) {
        return this.callContractFunction(this.hubContract, 'isContract', [contractAddress]);
    }

    async isAssetStorageContract(contractAddress) {
        return this.callContractFunction(this.hubContract, 'isAssetStorage', [contractAddress]);
    }

    async getNodeStake(identityId) {
        return this.callContractFunction(this.StakingStorageContract, 'totalStakes', [identityId]);
    }

    async getAssertionIdByIndex(assetContractAddress, tokenId, index) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toLowerCase()];
        if (!assetStorageContractInstance) throw Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getAssertionIdByIndex', [
            tokenId,
            index,
        ]);
    }

    async getLatestAssertionId(assetContractAddress, tokenId) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toLowerCase()];
        if (!assetStorageContractInstance) throw Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getLatestAssertionId', [
            tokenId,
        ]);
    }

    async getAssertionIssuer(assertionId) {
        return this.callContractFunction(this.AssertionStorageContract, 'getAssertionIssuer', [
            assertionId,
        ]);
    }

    async getAgreementData(agreementId) {
        const result = await this.callContractFunction(
            this.ServiceAgreementStorageV1Contract,
            'getAgreementData',
            [agreementId],
        );

        return {
            startTime: Number(result['0']),
            epochsNumber: Number(result['1']),
            epochLength: Number(result['2']),
            tokenAmount: result['3'],
            scoreFunctionId: Number(result['4'][0]),
            proofWindowOffsetPerc: Number(result['4'][1]),
        };
    }

    async getAssertionSize(assertionId) {
        return this.callContractFunction(this.AssertionStorageContract, 'getAssertionSize', [
            assertionId,
        ]);
    }

    async getAssertionTriplesNumber(assertionId) {
        return this.callContractFunction(
            this.AssertionStorageContract,
            'getAssertionTriplesNumber',
            [assertionId],
        );
    }

    async getAssertionChunksNumber(assertionId) {
        return this.callContractFunction(
            this.AssertionStorageContract,
            'getAssertionChunksNumber',
            [assertionId],
        );
    }

    async isCommitWindowOpen(agreementId, epoch) {
        return this.callContractFunction(this.ServiceAgreementV1Contract, 'isCommitWindowOpen', [
            agreementId,
            epoch,
        ]);
    }

    async getTopCommitSubmissions(agreementId, epoch) {
        const commits = await this.callContractFunction(
            this.ServiceAgreementV1Contract,
            'getTopCommitSubmissions',
            [agreementId, epoch],
        );

        return commits
            .filter((commit) => commit.identityId !== '0')
            .map((commit) => ({
                prevIdentityId: commit.prevIdentityId,
                identityId: commit.identityId,
                nextIdentityId: commit.nextIdentityId,
                score: commit.score,
            }));
    }

    async getR2() {
        return this.callContractFunction(this.ParametersStorageContract, 'r2', []);
    }

    async getR1() {
        return this.callContractFunction(this.ParametersStorageContract, 'r1', []);
    }

    async getR0() {
        return this.callContractFunction(this.ParametersStorageContract, 'r0', []);
    }

    async submitCommit(assetContractAddress, tokenId, keyword, hashFunctionId, epoch, callback) {
        return this.queueTransaction(
            this.ServiceAgreementV1Contract,
            'submitCommit',
            [[assetContractAddress, tokenId, keyword, hashFunctionId, epoch]],
            callback,
        );
    }

    async isProofWindowOpen(agreementId, epoch) {
        return this.callContractFunction(this.ServiceAgreementV1Contract, 'isProofWindowOpen', [
            agreementId,
            epoch,
        ]);
    }

    async getChallenge(assetContractAddress, tokenId, epoch) {
        const result = await this.callContractFunction(
            this.ServiceAgreementV1Contract,
            'getChallenge',
            [this.getPublicKey(), assetContractAddress, tokenId, epoch],
        );

        return { assertionId: result['0'], challenge: result['1'] };
    }

    async sendProof(
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        proof,
        chunkHash,
        callback,
    ) {
        return this.queueTransaction(
            this.ServiceAgreementV1Contract,
            'sendProof',
            [[assetContractAddress, tokenId, keyword, hashFunctionId, epoch, proof, chunkHash]],
            callback,
        );
    }

    async getShardingTableHead() {
        return this.callContractFunction(this.ShardingTableStorageContract, 'head', []);
    }

    async getShardingTableLength() {
        const nodesCount = await this.callContractFunction(
            this.ShardingTableStorageContract,
            'nodesCount',
            [],
        );
        return nodesCount;
    }

    async getShardingTablePage(startingIdentityId, nodesNum) {
        return this.callContractFunction(this.ShardingTableContract, 'getShardingTable', [
            startingIdentityId,
            nodesNum,
        ]);
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
        return ethers.utils.parseUnits(ether.toString(), fromUnit).toString();
    }

    convertFromWei(ether, toUnit = 'ether') {
        return ethers.utils.formatUnits(ether.toString(), toUnit).toString();
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

    async getCommitWindowDurationPerc() {
        return this.callContractFunction(
            this.ParametersStorageContract,
            'commitWindowDurationPerc',
            [],
        );
    }

    async getProofWindowDurationPerc() {
        return this.callContractFunction(
            this.ParametersStorageContract,
            'proofWindowDurationPerc',
            [],
        );
    }

    async isHashFunction(hashFunctionId) {
        return this.callContractFunction(this.HashingProxyContract, 'isHashFunction', [
            hashFunctionId,
        ]);
    }

    async isScoreFunction(scoreFunctionId) {
        return this.callContractFunction(this.ScoringProxyContract, 'isScoreFunction', [
            scoreFunctionId,
        ]);
    }

    async callScoreFunction(scoreFunctionId, hashFunctionId, peerId, keyword, stake) {
        return this.callContractFunction(this.ScoringProxyContract, 'callScoreFunction', [
            scoreFunctionId,
            hashFunctionId,
            this.convertAsciiToHex(peerId),
            keyword,
            stake,
        ]);
    }

    async getLog2PLDSFParams() {
        const log2pldsfParams = await this.callContractFunction(
            this.Log2PLDSFContract,
            'getParameters',
            [],
        );

        const params = {};
        params.distanceMappingCoefficient = log2pldsfParams['0'];
        params.stakeMappingCoefficient = log2pldsfParams['1'];

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
            params[paramNames[index]] = val;
        });

        return params;
    }
}

export default Web3Service;
