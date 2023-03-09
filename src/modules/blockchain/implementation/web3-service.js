import { ethers } from 'ethers';
import axios from 'axios';
import async from 'async';
import { setTimeout as sleep } from 'timers/promises';
import { createRequire } from 'module';

import {
    DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS,
    MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH,
    TRANSACTION_QUEUE_CONCURRENCY,
    FIXED_GAS_LIMIT_METHODS,
} from '../../../constants/constants.js';

const require = createRequire(import.meta.url);
const AbstractAsset = require('dkg-evm-module/abi/AbstractAsset.json');
const AssertionStorage = require('dkg-evm-module/abi/AssertionStorage.json');
const Staking = require('dkg-evm-module/abi/Staking.json');
const StakingStorage = require('dkg-evm-module/abi/StakingStorage.json');
const ERC20Token = require('dkg-evm-module/abi/Token.json');
const HashingProxy = require('dkg-evm-module/abi/HashingProxy.json');
const Hub = require('dkg-evm-module/abi/Hub.json');
const IdentityStorage = require('dkg-evm-module/abi/IdentityStorage.json');
const Log2PLDSF = require('dkg-evm-module/abi/Log2PLDSF.json');
const ParametersStorage = require('dkg-evm-module/abi/ParametersStorage.json');
const Profile = require('dkg-evm-module/abi/Profile.json');
const ProfileStorage = require('dkg-evm-module/abi/ProfileStorage.json');
const ScoringProxy = require('dkg-evm-module/abi/ScoringProxy.json');
const ServiceAgreementV1 = require('dkg-evm-module/abi/ServiceAgreementV1.json');
const CommitManagerV1U1 = require('dkg-evm-module/abi/CommitManagerV1U1.json');
const ProofManagerV1U1 = require('dkg-evm-module/abi/ProofManagerV1U1.json');
const ShardingTable = require('dkg-evm-module/abi/ShardingTable.json');
const ShardingTableStorage = require('dkg-evm-module/abi/ShardingTableStorage.json');
const ServiceAgreementStorageProxy = require('dkg-evm-module/abi/ServiceAgreementStorageProxy.json');
const UnfinalizedStateStorage = require('dkg-evm-module/abi/UnfinalizedStateStorage.json');

class Web3Service {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.rpcNumber = 0;
        this.initializeTransactionQueue(TRANSACTION_QUEUE_CONCURRENCY);
        await this.initializeWeb3();
        this.startBlock = await this.getBlockNumber();
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
                    this.provider = new ethers.providers.WebSocketProvider(
                        this.config.rpcEndpoints[this.rpcNumber],
                    );
                } else {
                    this.provider = new ethers.providers.JsonRpcProvider(
                        this.config.rpcEndpoints[this.rpcNumber],
                    );
                }
                // eslint-disable-next-line no-await-in-loop
                await this.providerReady();
                isRpcConnected = true;
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

        this.wallet = new ethers.Wallet(this.getPrivateKey(), this.provider);
    }

    async initializeContracts() {
        // TODO encapsulate in a generic function
        this.logger.info(
            `Initializing contracts with hub contract address: ${this.config.hubContractAddress}`,
        );
        this.hubContract = new ethers.Contract(this.config.hubContractAddress, Hub, this.wallet);

        const parametersStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ParametersStorage'],
        );
        this.ParametersStorageContract = new ethers.Contract(
            parametersStorageAddress,
            ParametersStorage,
            this.wallet,
        );

        const stakingContractAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['Staking'],
        );
        this.StakingContract = new ethers.Contract(stakingContractAddress, Staking, this.wallet);

        const stakingStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['StakingStorage'],
        );
        this.StakingStorageContract = new ethers.Contract(
            stakingStorageAddress,
            StakingStorage,
            this.wallet,
        );

        const hashingProxyAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['HashingProxy'],
        );
        this.HashingProxyContract = new ethers.Contract(
            hashingProxyAddress,
            HashingProxy,
            this.wallet,
        );

        const shardingTableAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ShardingTable'],
        );
        this.ShardingTableContract = new ethers.Contract(
            shardingTableAddress,
            ShardingTable,
            this.wallet,
        );

        const shardingTableStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ShardingTableStorage'],
        );
        this.ShardingTableStorageContract = new ethers.Contract(
            shardingTableStorageAddress,
            ShardingTableStorage,
            this.wallet,
        );

        const assertionStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['AssertionStorage'],
        );
        this.AssertionStorageContract = new ethers.Contract(
            assertionStorageAddress,
            AssertionStorage,
            this.wallet,
        );

        const tokenAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['Token'],
        );
        this.TokenContract = new ethers.Contract(tokenAddress, ERC20Token, this.wallet);

        const identityStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['IdentityStorage'],
        );
        this.IdentityStorageContract = new ethers.Contract(
            identityStorageAddress,
            IdentityStorage,
            this.wallet,
        );

        const profileAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['Profile'],
        );
        this.ProfileContract = new ethers.Contract(profileAddress, Profile, this.wallet);

        const profileStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ProfileStorage'],
        );
        this.ProfileStorageContract = new ethers.Contract(
            profileStorageAddress,
            ProfileStorage,
            this.wallet,
        );

        const serviceAgreementV1Address = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ServiceAgreementV1'],
        );
        this.ServiceAgreementV1Contract = new ethers.Contract(
            serviceAgreementV1Address,
            ServiceAgreementV1,
            this.wallet,
        );

        const commitManagerV1U1Address = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['CommitManagerV1U1'],
        );
        this.CommitManagerV1U1Contract = new ethers.Contract(
            commitManagerV1U1Address,
            CommitManagerV1U1,
            this.wallet,
        );

        const proofManagerV1U1Address = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ProofManagerV1U1'],
        );
        this.ProofManagerV1U1Contract = new ethers.Contract(
            proofManagerV1U1Address,
            ProofManagerV1U1,
            this.wallet,
        );

        const serviceAgreementStorageProxyAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ServiceAgreementStorageProxy'],
        );

        this.ServiceAgreementStorageProxy = new ethers.Contract(
            serviceAgreementStorageProxyAddress,
            ServiceAgreementStorageProxy,
            this.wallet,
        );

        const unfinalizedStateStorageAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['UnfinalizedStateStorage'],
        );

        this.UnfinalizedStateStorageContract = new ethers.Contract(
            unfinalizedStateStorageAddress,
            UnfinalizedStateStorage,
            this.wallet,
        );

        const scoringProxyAddress = await this.callContractFunction(
            this.hubContract,
            'getContractAddress',
            ['ScoringProxy'],
        );
        this.ScoringProxyContract = new ethers.Contract(
            scoringProxyAddress,
            ScoringProxy,
            this.wallet,
        );

        const log2PLDSFAddress = await this.callContractFunction(
            this.ScoringProxyContract,
            'getScoreFunctionContractAddress',
            [1],
        );
        this.Log2PLDSFContract = new ethers.Contract(log2PLDSFAddress, Log2PLDSF, this.wallet);

        this.assetStorageContracts = {};
        const assetStoragesArray = await this.callContractFunction(
            this.hubContract,
            'getAllAssetStorages',
            [],
        );
        assetStoragesArray.forEach((assetStorage) => {
            this.assetStorageContracts[assetStorage[1].toLowerCase()] = new ethers.Contract(
                assetStorage[1],
                AbstractAsset,
                this.wallet,
            );
        });

        this.logger.info(`Contracts initialized`);
        this.logger.debug(
            `Connected to blockchain rpc : ${this.config.rpcEndpoints[this.rpcNumber]}.`,
        );

        await this.logBalances();
    }

    async providerReady() {
        return this.provider.getNetwork();
    }

    getPrivateKey() {
        return this.config.evmOperationalWalletPrivateKey;
    }

    getPublicKey() {
        return this.wallet.address;
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
        const nativeBalance = await this.wallet.getBalance();
        return Number(ethers.utils.formatEther(nativeBalance));
    }

    async getTokenBalance() {
        const tokenBalance = await this.callContractFunction(this.TokenContract, 'balanceOf', [
            this.getPublicKey(),
        ]);
        return Number(ethers.utils.formatEther(tokenBalance));
    }

    async getBlockNumber() {
        const latestBlock = await this.provider.getBlock('latest');
        return latestBlock.number;
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
                result = await contractInstance[functionName](...args);
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
                    gasLimit = await contractInstance.estimateGas[functionName](...args);
                }

                const gas = gasLimit ?? this.convertToWei(900, 'kwei');

                this.logger.info(
                    'Sending signed transaction to blockchain, calling method: ' +
                        `${functionName} with gas limit: ${gas.toString()} and gasPrice ${gasPrice.toString()}`,
                );
                result = await contractInstance[functionName](...args, {
                    gasPrice,
                    gasLimit: gas,
                });
            } catch (error) {
                this.logger.warn(
                    `Failed executing smart contract function ${functionName}. Error: ${error.message}`,
                );
                if (
                    !transactionRetried &&
                    (error.message.includes(`Transaction was not mined within`) ||
                        error.message.includes(`Pool(TooLowPriority`))
                ) {
                    gasPrice = Math.ceil(gasPrice * 1.2);
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
        blockchainId,
        contractName,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        const contract = this[contractName];
        if (!contract) {
            throw Error(`Error while getting all past events. Unknown contract: ${contractName}`);
        }

        let fromBlock;
        if (this.isOlderThan(lastCheckedTimestamp, DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS)) {
            fromBlock = this.startBlock - 10;
        } else {
            fromBlock = lastCheckedBlock + 1;
        }

        let events = [];
        if (currentBlock - fromBlock > MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH) {
            let iteration = 1;

            while (fromBlock - MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH > currentBlock) {
                events.concat(
                    await contract.queryFilter(
                        '*',
                        fromBlock,
                        fromBlock + MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH * iteration,
                    ),
                );
                fromBlock += MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH * iteration;
                iteration += 1;
            }
        } else {
            events = await contract.queryFilter('*', fromBlock, currentBlock);
        }

        return events
            ? events.map((event) => ({
                  contract: contractName,
                  event: event.event,
                  data: JSON.stringify(
                      Object.fromEntries(
                          Object.entries(event.args).map(([k, v]) => [
                              k,
                              ethers.BigNumber.isBigNumber(v) ? v.toString() : v,
                          ]),
                      ),
                  ),
                  block: event.blockNumber,
                  blockchainId,
              }))
            : [];
    }

    isOlderThan(timestamp, olderThanInMills) {
        if (!timestamp) return true;
        const timestampThirtyDaysInPast = new Date().getTime() - olderThanInMills;
        return timestamp < timestampThirtyDaysInPast;
    }

    async isHubContract(contractAddress) {
        return this.callContractFunction(this.hubContract, 'isContract(address)', [
            contractAddress,
        ]);
    }

    async isAssetStorageContract(contractAddress) {
        return this.callContractFunction(this.hubContract, 'isAssetStorage(address)', [
            contractAddress,
        ]);
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
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance) throw Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getLatestAssertionId', [
            tokenId,
        ]);
    }

    async getLatestTokenId(assetContractAddress) {
        return this.provider.getStorageAt(
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()],
            7,
        );
    }

    async getAssertionIds(assetContractAddress, tokenId) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance) throw Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getAssertionIds', [
            tokenId,
        ]);
    }

    async getUnfinalizedState(tokenId) {
        return this.callContractFunction(
            this.UnfinalizedStateStorageContract,
            'getUnfinalizedState',
            [tokenId],
        );
    }

    async getAssertionIssuer(assertionId) {
        return this.callContractFunction(this.AssertionStorageContract, 'getAssertionIssuer', [
            assertionId,
        ]);
    }

    async getAgreementData(agreementId) {
        const result = await this.callContractFunction(
            this.ServiceAgreementStorageProxy,
            'getAgreementData',
            [agreementId],
        );

        return {
            startTime: result['0'].toNumber(),
            epochsNumber: result['1'],
            epochLength: result['2'].toNumber(),
            tokenAmount: result['3'][0],
            addedTokenAmount: result['3'][1],
            scoreFunctionId: result['4'][0],
            proofWindowOffsetPerc: result['4'][1],
        };
    }

    async getAssertionSize(assertionId) {
        const assertionSize = await this.callContractFunction(
            this.AssertionStorageContract,
            'getAssertionSize',
            [assertionId],
        );
        return Number(assertionSize);
    }

    async getAssertionTriplesNumber(assertionId) {
        const assertionTriplesNumber = await this.callContractFunction(
            this.AssertionStorageContract,
            'getAssertionTriplesNumber',
            [assertionId],
        );
        return Number(assertionTriplesNumber);
    }

    async getAssertionChunksNumber(assertionId) {
        const assertionChunksNumber = await this.callContractFunction(
            this.AssertionStorageContract,
            'getAssertionChunksNumber',
            [assertionId],
        );
        return Number(assertionChunksNumber);
    }

    async isCommitWindowOpen(agreementId, epoch) {
        return this.callContractFunction(this.CommitManagerV1U1Contract, 'isCommitWindowOpen', [
            agreementId,
            epoch,
        ]);
    }

    async getTopCommitSubmissions(agreementId, epoch, stateIndex) {
        const commits = await this.callContractFunction(
            this.CommitManagerV1U1Contract,
            'getTopCommitSubmissions',
            [agreementId, epoch, stateIndex],
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
        const r2 = await this.callContractFunction(this.ParametersStorageContract, 'r2', []);
        return r2;
    }

    async getR1() {
        const r1 = await this.callContractFunction(this.ParametersStorageContract, 'r1', []);
        return r1;
    }

    async getR0() {
        const r0 = await this.callContractFunction(this.ParametersStorageContract, 'r0', []);
        return r0;
    }

    async getFinalizationCommitsNumber() {
        const finalizationCommitsNumber = await this.callContractFunction(
            this.ParametersStorageContract,
            'finalizationCommitsNumber',
            [],
        );
        return finalizationCommitsNumber;
    }

    async submitCommit(assetContractAddress, tokenId, keyword, hashFunctionId, epoch, callback) {
        return this.queueTransaction(
            this.CommitManagerV1U1Contract,
            'submitCommit',
            [[assetContractAddress, tokenId, keyword, hashFunctionId, epoch]],
            callback,
        );
    }

    async submitUpdateCommit(assetContractAddress, tokenId, keyword, hashFunctionId, epoch) {
        return this.queueTransaction(this.CommitManagerV1U1Contract, 'submitUpdateCommit', [
            [assetContractAddress, tokenId, keyword, hashFunctionId, epoch],
        ]);
    }

    async isProofWindowOpen(agreementId, epoch) {
        return this.callContractFunction(this.ProofManagerV1U1Contract, 'isProofWindowOpen', [
            agreementId,
            epoch,
        ]);
    }

    async getChallenge(assetContractAddress, tokenId, epoch) {
        const result = await this.callContractFunction(
            this.ProofManagerV1U1Contract,
            'getChallenge',
            [assetContractAddress, tokenId, epoch],
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
            this.ProofManagerV1U1Contract,
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
        return Number(nodesCount);
    }

    async getShardingTablePage(startingIdentityId, nodesNum) {
        return this.callContractFunction(
            this.ShardingTableContract,
            'getShardingTable(uint72,uint72)',
            [startingIdentityId, nodesNum],
        );
    }

    getBlockchainId() {
        return this.getImplementationName();
    }

    toBigNumber(value) {
        return ethers.BigNumber.from(value);
    }

    keccak256(bytesLikeData) {
        return ethers.keccak256(bytesLikeData);
    }

    sha256(bytesLikeData) {
        return ethers.utils.sha256(bytesLikeData);
    }

    encodePacked(types, values) {
        return ethers.utils.solidityPack(types, values);
    }

    convertAsciiToHex(string) {
        return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(string));
    }

    convertHexToAscii(hexString) {
        return ethers.utils.toUtf8String(hexString);
    }

    convertBytesToUint8Array(bytesLikeData) {
        return ethers.utils.arrayify(bytesLikeData);
    }

    convertToWei(value, fromUnit = 'ether') {
        return ethers.utils.parseUnits(value.toString(), fromUnit).toString();
    }

    convertFromWei(value, toUnit = 'ether') {
        return ethers.utils.formatUnits(value, toUnit);
    }

    async healthCheck() {
        try {
            const gasPrice = await this.wallet.getGasPrice();
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
            await this.provider.getNetwork();
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

    async getUpdateCommitWindowDuration() {
        const commitWindowDurationPerc = await this.callContractFunction(
            this.ParametersStorageContract,
            'updateCommitWindowDuration',
            [],
        );
        return Number(commitWindowDurationPerc);
    }

    async getCommitWindowDurationPerc() {
        const commitWindowDurationPerc = await this.callContractFunction(
            this.ParametersStorageContract,
            'commitWindowDurationPerc',
            [],
        );
        return Number(commitWindowDurationPerc);
    }

    async getProofWindowDurationPerc() {
        return this.callContractFunction(
            this.ParametersStorageContract,
            'proofWindowDurationPerc',
            [],
        );
    }

    async isHashFunction(hashFunctionId) {
        return this.callContractFunction(this.HashingProxyContract, 'isHashFunction(uint8)', [
            hashFunctionId,
        ]);
    }

    async isScoreFunction(scoreFunctionId) {
        return this.callContractFunction(this.ScoringProxyContract, 'isScoreFunction(uint8)', [
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

    async getBlockchainTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    async getLatestBlock() {
        const currentBlock = await this.provider.getBlockNumber();
        const blockTimestamp = await this.provider.getBlock(currentBlock);
        return blockTimestamp;
    }

    async hasPendingUpdate(tokenId) {
        return this.callContractFunction(this.UnfinalizedStateStorageContract, 'hasPendingUpdate', [
            tokenId,
        ]);
    }
}

export default Web3Service;
