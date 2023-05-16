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
    TRANSACTION_POLLING_TIMEOUT_MILLIS,
    TRANSACTION_CONFIRMATIONS,
    BLOCK_TIME_MILLIS,
} from '../../../constants/constants.js';

const require = createRequire(import.meta.url);

const ABIs = {
    AbstractAsset: require('dkg-evm-module/abi/AbstractAsset.json'),
    AssertionStorage: require('dkg-evm-module/abi/AssertionStorage.json'),
    Staking: require('dkg-evm-module/abi/Staking.json'),
    StakingStorage: require('dkg-evm-module/abi/StakingStorage.json'),
    Token: require('dkg-evm-module/abi/Token.json'),
    HashingProxy: require('dkg-evm-module/abi/HashingProxy.json'),
    Hub: require('dkg-evm-module/abi/Hub.json'),
    IdentityStorage: require('dkg-evm-module/abi/IdentityStorage.json'),
    Log2PLDSF: require('dkg-evm-module/abi/Log2PLDSF.json'),
    ParametersStorage: require('dkg-evm-module/abi/ParametersStorage.json'),
    Profile: require('dkg-evm-module/abi/Profile.json'),
    ProfileStorage: require('dkg-evm-module/abi/ProfileStorage.json'),
    ScoringProxy: require('dkg-evm-module/abi/ScoringProxy.json'),
    ServiceAgreementV1: require('dkg-evm-module/abi/ServiceAgreementV1.json'),
    CommitManagerV1: require('dkg-evm-module/abi/CommitManagerV1.json'),
    CommitManagerV1U1: require('dkg-evm-module/abi/CommitManagerV1U1.json'),
    ProofManagerV1: require('dkg-evm-module/abi/ProofManagerV1.json'),
    ProofManagerV1U1: require('dkg-evm-module/abi/ProofManagerV1U1.json'),
    ShardingTable: require('dkg-evm-module/abi/ShardingTable.json'),
    ShardingTableStorage: require('dkg-evm-module/abi/ShardingTableStorage.json'),
    ServiceAgreementStorageProxy: require('dkg-evm-module/abi/ServiceAgreementStorageProxy.json'),
    UnfinalizedStateStorage: require('dkg-evm-module/abi/UnfinalizedStateStorage.json'),
};

const SCORING_FUNCTIONS = {
    1: 'Log2PLDSF',
};

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
        this.transactionQueue = async.queue((args, cb) => {
            const { contractInstance, functionName, transactionArgs } = args;
            this._executeContractFunction(contractInstance, functionName, transactionArgs)
                .then((result) => {
                    cb({ result });
                })
                .catch((error) => {
                    cb({ error });
                });
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
        this.logger.info(
            `Initializing contracts with hub contract address: ${this.config.hubContractAddress}`,
        );
        this.HubContract = new ethers.Contract(
            this.config.hubContractAddress,
            ABIs.Hub,
            this.wallet,
        );

        const contractsArray = await this.callContractFunction(
            this.HubContract,
            'getAllContracts',
            [],
        );

        contractsArray.forEach(([contractName, contractAddress]) => {
            this.initializeContract(contractName, contractAddress);
        });

        this.scoringFunctionsContracts = {};
        const scoringFunctionsArray = await this.callContractFunction(
            this.ScoringProxyContract,
            'getAllScoreFunctions',
            [],
        );
        scoringFunctionsArray.forEach(([id, scoringContractAddress]) => {
            this.initializeScoringContract(id, scoringContractAddress);
        });

        this.assetStorageContracts = {};
        const assetStoragesArray = await this.callContractFunction(
            this.HubContract,
            'getAllAssetStorages',
            [],
        );
        assetStoragesArray.forEach(([, assetStorageAddress]) => {
            this.initializeAssetStorageContract(assetStorageAddress);
        });

        this.logger.info(`Contracts initialized`);
        this.logger.debug(
            `Connected to blockchain rpc : ${this.config.rpcEndpoints[this.rpcNumber]}.`,
        );

        await this.logBalances();
    }

    initializeAssetStorageContract(assetStorageAddress) {
        this.assetStorageContracts[assetStorageAddress.toLowerCase()] = new ethers.Contract(
            assetStorageAddress,
            ABIs.AbstractAsset,
            this.wallet,
        );
    }

    initializeScoringContract(id, contractAddress) {
        const contractName = SCORING_FUNCTIONS[id];

        if (ABIs[contractName] != null) {
            this.scoringFunctionsContracts[id] = new ethers.Contract(
                contractAddress,
                ABIs[contractName],
                this.wallet,
            );
        } else {
            this.logger.trace(
                `Skipping initialisation of contract with id: ${id}, address: ${contractAddress}`,
            );
        }
    }

    initializeContract(contractName, contractAddress) {
        if (ABIs[contractName] != null) {
            this[`${contractName}Contract`] = new ethers.Contract(
                contractAddress,
                ABIs[contractName],
                this.wallet,
            );
        } else {
            this.logger.trace(
                `Skipping initialisation of contract: ${contractName}, address: ${contractAddress}`,
            );
        }
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

    getBlockTimeMillis() {
        return BLOCK_TIME_MILLIS.DEFAULT;
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
                const tx = await contractInstance[functionName](...args, {
                    gasPrice,
                    gasLimit: gas,
                });
                result = await this.provider.waitForTransaction(
                    tx.hash,
                    TRANSACTION_CONFIRMATIONS,
                    TRANSACTION_POLLING_TIMEOUT_MILLIS,
                );
            } catch (error) {
                this.logger.warn(
                    `Failed executing smart contract function ${functionName}. Error: ${error.message}`,
                );
                if (
                    !transactionRetried &&
                    (error.message.includes(`timeout exceeded`) ||
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
            fromBlock = this.startBlock;
        } else {
            fromBlock = lastCheckedBlock + 1;
        }

        let events = [];
        while (fromBlock <= currentBlock) {
            const toBlock = Math.min(
                fromBlock + MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH - 1,
                currentBlock,
            );
            const newEvents = await contract.queryFilter('*', fromBlock, toBlock);
            events = events.concat(newEvents);
            fromBlock = toBlock + 1;
        }

        return events.map((event) => ({
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
        }));
    }

    isOlderThan(timestamp, olderThanInMills) {
        if (!timestamp) return true;
        const timestampThirtyDaysInPast = new Date().getTime() - olderThanInMills;
        return timestamp < timestampThirtyDaysInPast;
    }

    async isHubContract(contractAddress) {
        return this.callContractFunction(this.HubContract, 'isContract(address)', [
            contractAddress,
        ]);
    }

    async isAssetStorageContract(contractAddress) {
        return this.callContractFunction(this.HubContract, 'isAssetStorage(address)', [
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
        return this.provider.getStorageAt(assetContractAddress.toString().toLowerCase(), 7);
    }

    getAssetStorageContractAddresses() {
        return Object.keys(this.assetStorageContracts);
    }

    async getAssertionIds(assetContractAddress, tokenId) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance) throw Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getAssertionIds', [
            tokenId,
        ]);
    }

    async getAssertionIdsLength(assetContractAddress, tokenId) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance) throw Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getAssertionIdsLength', [
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
            this.ServiceAgreementStorageProxyContract,
            'getAgreementData',
            [agreementId],
        );

        return {
            startTime: result['0'].toNumber(),
            epochsNumber: result['1'],
            epochLength: result['2'].toNumber(),
            tokenAmount: result['3'][0],
            updateTokenAmount: result['3'][1],
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

    selectCommitManagerContract(latestStateIndex) {
        return latestStateIndex === 0
            ? this.CommitManagerV1Contract
            : this.CommitManagerV1U1Contract;
    }

    async isCommitWindowOpen(agreementId, epoch, latestStateIndex) {
        return this.callContractFunction(
            this.selectCommitManagerContract(latestStateIndex),
            'isCommitWindowOpen',
            [agreementId, epoch],
        );
    }

    async isUpdateCommitWindowOpen(agreementId, epoch, stateIndex) {
        return this.callContractFunction(
            this.CommitManagerV1U1Contract,
            'isUpdateCommitWindowOpen',
            [agreementId, epoch, stateIndex],
        );
    }

    async getTopCommitSubmissions(agreementId, epoch, latestStateIndex) {
        const args =
            latestStateIndex === 0 ? [agreementId, epoch] : [agreementId, epoch, latestStateIndex];

        const commits = await this.callContractFunction(
            this.selectCommitManagerContract(latestStateIndex),
            'getTopCommitSubmissions',
            args,
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

    async submitCommit(
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        latestStateIndex,
        callback,
    ) {
        return this.queueTransaction(
            this.selectCommitManagerContract(latestStateIndex),
            'submitCommit',
            [[assetContractAddress, tokenId, keyword, hashFunctionId, epoch]],
            callback,
        );
    }

    async submitUpdateCommit(
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        callback,
    ) {
        return this.queueTransaction(
            this.CommitManagerV1U1Contract,
            'submitUpdateCommit',
            [[assetContractAddress, tokenId, keyword, hashFunctionId, epoch]],
            callback,
        );
    }

    selectProofManagerContract(latestStateIndex) {
        return latestStateIndex === 0 ? this.ProofManagerV1Contract : this.ProofManagerV1U1Contract;
    }

    async isProofWindowOpen(agreementId, epoch, latestStateIndex) {
        return this.callContractFunction(
            this.selectProofManagerContract(latestStateIndex),
            'isProofWindowOpen',
            [agreementId, epoch],
        );
    }

    async getChallenge(assetContractAddress, tokenId, epoch, latestStateIndex) {
        const args =
            latestStateIndex === 0
                ? [this.getPublicKey(), assetContractAddress, tokenId, epoch]
                : [assetContractAddress, tokenId, epoch];

        const result = await this.callContractFunction(
            this.selectProofManagerContract(latestStateIndex),
            'getChallenge',
            args,
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
        latestStateIndex,
        callback,
    ) {
        return this.queueTransaction(
            this.selectProofManagerContract(latestStateIndex),
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

    async getEpochLength() {
        const epochLength = await this.callContractFunction(
            this.ParametersStorageContract,
            'epochLength',
            [],
        );
        return Number(epochLength);
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
            this.scoringFunctionsContracts[1],
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
