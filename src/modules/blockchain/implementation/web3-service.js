import Web3 from 'web3';
import axios from 'axios';
import { setTimeout as sleep } from 'timers/promises';
import { createRequire } from 'module';

import {
    DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS,
    INIT_ASK_AMOUNT,
    INIT_STAKE_AMOUNT,
    MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH,
    WEBSOCKET_PROVIDER_OPTIONS,
} from '../../../constants/constants.js';

const require = createRequire(import.meta.url);
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const AssertionRegistry = require('dkg-evm-module/build/contracts/AssertionRegistry.json');
const ContentAsset = require('dkg-evm-module/build/contracts/ContentAsset.json');
const HashingProxy = require('dkg-evm-module/build/contracts/HashingProxy.json');
const ERC20Token = require('dkg-evm-module/build/contracts/ERC20Token.json');
const ParametersStorage = require('dkg-evm-module/build/contracts/ParametersStorage.json');
const Profile = require('dkg-evm-module/build/contracts/Profile.json');
const ProfileStorage = require('dkg-evm-module/build/contracts/ProfileStorage.json');
const ShardingTable = require('dkg-evm-module/build/contracts/ShardingTable.json');
const ServiceAgreementStorage = require('dkg-evm-module/build/contracts/ServiceAgreementStorage.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');

class Web3Service {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.rpcNumber = 0;
        await this.initializeWeb3();
        this.currentBlock = await this.web3.eth.getBlockNumber();
        await this.initializeContracts();
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
        this.logger.info(`Hub contract address is ${this.config.hubContractAddress}`);
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

        // TODO: Change this nonsense
        this.assetContracts = {
            [contentAssetAddress.toLowerCase()]: this.ContentAssetContract,
        };

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

    getBlockNumber() {
        return this.web3.eth.getBlockNumber();
    }

    // TODO get from blockchain
    getBlockTime() {
        return this.config.blockTime;
    }

    async getIdentityId() {
        try {
            const identityId = await this.callContractFunction(
                this.IdentityStorageContract,
                'getIdentityId',
                [this.getPublicKey()],
            );
            return Number(identityId);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return 0;
        }
    }

    async identityIdExists() {
        const identityId = await this.getIdentityId();

        return identityId !== 0;
    }

    async createProfile(peerId) {
        const initialAsk = Web3.utils.toWei(INIT_ASK_AMOUNT, 'ether');
        const initialStake = Web3.utils.toWei(INIT_STAKE_AMOUNT, 'ether');

        await this.executeContractFunction(this.TokenContract, 'increaseAllowance', [
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
                await this.executeContractFunction(this.ProfileContract, 'createProfile', [
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
                } else if (retryCount + 1 <= maxNumberOfRetries) {
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
                    await this.executeContractFunction(this.TokenContract, 'decreaseAllowance', [
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

    async executeContractFunction(contractInstance, functionName, args) {
        let result;
        while (result === undefined) {
            try {
                /* eslint-disable no-await-in-loop */
                const gasPrice = await this.getGasPrice();

                const gasLimit = await contractInstance.methods[functionName](...args).estimateGas({
                    from: this.getPublicKey(),
                });

                const encodedABI = contractInstance.methods[functionName](...args).encodeABI();
                const tx = {
                    from: this.getPublicKey(),
                    to: contractInstance.options.address,
                    data: encodedABI,
                    gasPrice: gasPrice || this.web3.utils.toWei('20', 'Gwei'),
                    gas: gasLimit || this.web3.utils.toWei('900', 'Kwei'),
                };

                const createdTransaction = await this.web3.eth.accounts.signTransaction(
                    tx,
                    this.getPrivateKey(),
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
                    gasPrice: gasPrice ?? this.web3.utils.toWei('20', 'Gwei'),
                    gas: gasLimit ?? this.web3.utils.toWei('900', 'Kwei'),
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
        try {
            const assertionsLength = await this.callContractFunction(
                this.assetContracts[assetContractAddress.toLowerCase()], // TODO: Change this nonsense
                'getAssertionsLength',
                [tokenId],
            );
            return Number(assertionsLength);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAssertionByIndex(assetContractAddress, tokenId, index) {
        try {
            return await this.callContractFunction(
                this.assetContracts[assetContractAddress.toLowerCase()], // TODO: Change this nonsense
                'getAssertionByIndex',
                [tokenId, index],
            );
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getLatestAssertion(assetContractAddress, tokenId) {
        try {
            return await this.callContractFunction(
                this.assetContracts[assetContractAddress.toLowerCase()], // TODO: Change this nonsense
                'getLatestAssertion',
                [tokenId],
            );
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAssertionIssuer(assertionId) {
        try {
            return await this.callContractFunction(this.AssertionRegistryContract, 'getIssuer', [
                assertionId,
            ]);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAgreementData(agreementId) {
        try {
            const agreementData = await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'getAgreementData',
                [agreementId],
            );

            agreementData.startTime = Number(agreementData['0']);
            agreementData.epochsNumber = Number(agreementData['1']);
            agreementData.epochLength = Number(agreementData['2']);
            agreementData.tokenAmount = Number(agreementData['3']);
            agreementData.scoreFunctionId = Number(agreementData['4']);
            agreementData.proofWindowOffsetPerc = Number(agreementData['5']);

            delete agreementData['0'];
            delete agreementData['1'];
            delete agreementData['2'];
            delete agreementData['3'];
            delete agreementData['4'];
            delete agreementData['5'];

            return agreementData;
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAgreementStartTime(agreementId) {
        try {
            const startTime = await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'getAgreementStartTime',
                [agreementId],
            );
            return Number(startTime);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAgreementEpochsNumber(agreementId) {
        try {
            const epochsNumber = await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'getAgreementEpochsNumber',
                [agreementId],
            );
            return Number(epochsNumber);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAgreementEpochLength(agreementId) {
        try {
            const epochLength = await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'getAgreementEpochLength',
                [agreementId],
            );
            return Number(epochLength);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAgreementTokenAmount(agreementId) {
        try {
            const tokenAmount = await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'getAgreementTokenAmount',
                [agreementId],
            );
            return Number(tokenAmount);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAgreementScoreFunctionId(agreementId) {
        try {
            const scoreFunctionId = await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'getAgreementScoreFunctionId',
                [agreementId],
            );
            return Number(scoreFunctionId);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getAgreementProofWindowOffsetPerc(agreementId) {
        try {
            const proofWindowOffsetPerc = await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'getAgreementProofWindowOffsetPerc',
                [agreementId],
            );
            return Number(proofWindowOffsetPerc);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async isCommitWindowOpen(agreementId, epoch) {
        try {
            return await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'isCommitWindowOpen',
                [agreementId, epoch],
            );
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getCommitSubmissions(agreementId, epoch) {
        try {
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
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getHashFunctionName(hashFunctionId) {
        try {
            return await this.callContractFunction(
                this.HashingProxyContract,
                'getHashFunctionName',
                [hashFunctionId],
            );
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async callHashFunction(hashFunctionId, data) {
        try {
            return await this.callContractFunction(this.HashingProxyContract, 'callHashFunction', [
                hashFunctionId,
                data,
            ]);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getR2() {
        try {
            const R2 = await this.callContractFunction(this.ParametersStorageContract, 'R2', []);
            return Number(R2);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getR1() {
        try {
            const R1 = await this.callContractFunction(this.ParametersStorageContract, 'R1', []);
            return Number(R1);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getR0() {
        try {
            const R0 = await this.callContractFunction(this.ParametersStorageContract, 'R0', []);
            return Number(R0);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async submitCommit(
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        prevIdentityId,
    ) {
        try {
            return await this.executeContractFunction(
                this.ServiceAgreementStorageContract,
                'submitCommit',
                [assetContractAddress, tokenId, keyword, hashFunctionId, epoch, prevIdentityId],
            );
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async isProofWindowOpen(agreementId, epoch) {
        try {
            return await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'isProofWindowOpen',
                [agreementId, epoch],
            );
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getChallenge(assetContractAddress, tokenId, epoch) {
        try {
            const challengeDict = await this.callContractFunction(
                this.ServiceAgreementStorageContract,
                'getChallenge',
                [assetContractAddress, tokenId, epoch],
            );

            challengeDict.assertionId = challengeDict['0'];
            challengeDict.challenge = Number(challengeDict['1']);

            delete challengeDict['0'];
            delete challengeDict['1'];

            return challengeDict;
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
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
        try {
            return await this.executeContractFunction(
                this.ServiceAgreementStorageContract,
                'sendProof',
                [assetContractAddress, tokenId, keyword, hashFunctionId, epoch, proof, chunkHash],
            );
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getShardingTableHead() {
        try {
            return await this.callContractFunction(this.ShardingTableContract, 'head', []);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getShardingTableLength() {
        try {
            const nodesCount = await this.callContractFunction(
                this.ShardingTableContract,
                'nodesCount',
                [],
            );
            return Number(nodesCount);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getShardingTablePage(startingPeerId, nodesNum) {
        try {
            return await this.callContractFunction(this.ShardingTableContract, 'getShardingTable', [
                startingPeerId,
                nodesNum,
            ]);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getShardingTableFull() {
        try {
            return await this.callContractFunction(
                this.ShardingTableContract,
                'getShardingTable',
                [],
            );
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
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
        try {
            const commitWindowDuration = await this.callContractFunction(
                this.ParametersStorageContract,
                'commitWindowDuration',
                [],
            );
            return Number(commitWindowDuration);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }

    async getProofWindowDurationPerc() {
        try {
            const proofWindowDurationPerc = await this.callContractFunction(
                this.ParametersStorageContract,
                'proofWindowDurationPerc',
                [],
            );
            return Number(proofWindowDurationPerc);
        } catch (e) {
            this.logger.error(`Error on calling contract function. ${e}`);
            return false;
        }
    }
}

export default Web3Service;
