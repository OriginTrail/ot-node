/* eslint-disable no-await-in-loop */
import { ethers, BigNumber } from 'ethers';
import axios from 'axios';
import async from 'async';
import { setTimeout as sleep } from 'timers/promises';
import { createRequire } from 'module';

import {
    SOLIDITY_ERROR_STRING_PREFIX,
    SOLIDITY_PANIC_CODE_PREFIX,
    SOLIDITY_PANIC_REASONS,
    ZERO_PREFIX,
    MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH,
    TRANSACTION_QUEUE_CONCURRENCY,
    TRANSACTION_POLLING_TIMEOUT_MILLIS,
    TRANSACTION_CONFIRMATIONS,
    BLOCK_TIME_MILLIS,
    WS_RPC_PROVIDER_PRIORITY,
    HTTP_RPC_PROVIDER_PRIORITY,
    FALLBACK_PROVIDER_QUORUM,
    RPC_PROVIDER_STALL_TIMEOUT,
    CACHED_FUNCTIONS,
    CACHE_DATA_TYPES,
    CONTRACTS,
    CONTRACT_FUNCTION_PRIORITY,
    TRANSACTION_PRIORITY,
    CONTRACT_FUNCTION_GAS_LIMIT_INCREASE_FACTORS,
    MAX_BLOCKCHAIN_EVENT_SYNC_OF_HISTORICAL_BLOCKS_IN_MILLS,
} from '../../../constants/constants.js';
import Web3ServiceValidator from './web3-service-validator.js';

const require = createRequire(import.meta.url);

const ABIs = {
    ContentAsset: require('dkg-evm-module/abi/ContentAsset.json'),
    ContentAssetStorage: require('dkg-evm-module/abi/ContentAssetStorageV2.json'),
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
    CommitManagerV1: require('dkg-evm-module/abi/CommitManagerV2.json'),
    CommitManagerV1U1: require('dkg-evm-module/abi/CommitManagerV2U1.json'),
    ProofManagerV1: require('dkg-evm-module/abi/ProofManagerV1.json'),
    ProofManagerV1U1: require('dkg-evm-module/abi/ProofManagerV1U1.json'),
    ShardingTable: require('dkg-evm-module/abi/ShardingTableV2.json'),
    ShardingTableStorage: require('dkg-evm-module/abi/ShardingTableStorageV2.json'),
    ServiceAgreementStorageProxy: require('dkg-evm-module/abi/ServiceAgreementStorageProxy.json'),
    UnfinalizedStateStorage: require('dkg-evm-module/abi/UnfinalizedStateStorage.json'),
    LinearSum: require('dkg-evm-module/abi/LinearSum.json'),
    ParanetsRegistry: require('dkg-evm-module/abi/ParanetsRegistry.json'),
    ParanetKnowledgeAssetsRegistry: require('dkg-evm-module/abi/ParanetKnowledgeAssetsRegistry.json'),
};

const SCORING_FUNCTIONS = {
    1: 'Log2PLDSF',
    2: 'LinearSum',
};

class Web3Service {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        this.contractCallCache = {};
        await this.initializeWeb3();
        this.initializeTransactionQueues();
        this.startBlock = await this.getBlockNumber();
        await this.initializeContracts();

        this.initializeProviderDebugging();
    }

    initializeTransactionQueues(concurrency = TRANSACTION_QUEUE_CONCURRENCY) {
        this.transactionQueues = {};
        for (const operationalWallet of this.operationalWallets) {
            const transactionQueue = async.queue((args, cb) => {
                const { contractInstance, functionName, transactionArgs, gasPrice } = args;
                this._executeContractFunction(
                    contractInstance,
                    functionName,
                    transactionArgs,
                    gasPrice,
                    operationalWallet,
                )
                    .then((result) => {
                        cb({ result });
                    })
                    .catch((error) => {
                        cb({ error });
                    });
            }, concurrency);
            this.transactionQueues[operationalWallet.address] = transactionQueue;
        }
        this.transactionQueueOrder = Object.keys(this.transactionQueues);
    }

    queueTransaction(contractInstance, functionName, transactionArgs, callback, gasPrice) {
        const selectedQueue = this.selectTransactionQueue();
        const priority = CONTRACT_FUNCTION_PRIORITY[functionName] ?? TRANSACTION_PRIORITY.REGULAR;
        this.logger.info(`Calling ${functionName} with priority: ${priority}`);
        switch (priority) {
            case TRANSACTION_PRIORITY.HIGH:
                selectedQueue.unshift(
                    {
                        contractInstance,
                        functionName,
                        transactionArgs,
                        gasPrice,
                    },
                    callback,
                );
                break;
            case TRANSACTION_PRIORITY.REGULAR:
            default:
                selectedQueue.push(
                    {
                        contractInstance,
                        functionName,
                        transactionArgs,
                        gasPrice,
                    },
                    callback,
                );
                break;
        }
    }

    removeTransactionQueue(walletAddress) {
        delete this.transactionQueues[walletAddress];
    }

    getTotalTransactionQueueLength() {
        let totalLength = 0;
        Object.values(this.transactionQueues).forEach((queue) => {
            totalLength += queue.length();
        });
        return totalLength;
    }

    selectTransactionQueue() {
        const queues = Object.keys(this.transactionQueues).map((wallet) => ({
            wallet,
            length: this.transactionQueues[wallet].length(),
        }));
        const minLength = Math.min(...queues.map((queue) => queue.length));
        const shortestQueues = queues.filter((queue) => queue.length === minLength);
        if (shortestQueues.length === 1) {
            return this.transactionQueues[shortestQueues[0].wallet];
        }

        const selectedQueueWallet = this.transactionQueueOrder.find((roundRobinNext) =>
            shortestQueues.some((shortestQueue) => shortestQueue.wallet === roundRobinNext),
        );

        this.transactionQueueOrder.push(
            this.transactionQueueOrder
                .splice(this.transactionQueueOrder.indexOf(selectedQueueWallet), 1)
                .pop(),
        );
        return this.transactionQueues[selectedQueueWallet];
    }

    getValidOperationalWallets() {
        const wallets = [];
        this.config.operationalWallets.forEach((wallet) => {
            try {
                wallets.push(new ethers.Wallet(wallet.privateKey, this.provider));
            } catch (error) {
                this.logger.warn(
                    `Invalid evm private key, unable to create wallet instance. Wallet public key: ${wallet.evmAddress}. Error: ${error.message}`,
                );
            }
        });
        return wallets;
    }

    async initializeWeb3() {
        const providers = [];
        for (const rpcEndpoint of this.config.rpcEndpoints) {
            const isWebSocket = rpcEndpoint.startsWith('ws');
            const Provider = isWebSocket
                ? ethers.providers.WebSocketProvider
                : ethers.providers.JsonRpcProvider;
            const priority = isWebSocket ? WS_RPC_PROVIDER_PRIORITY : HTTP_RPC_PROVIDER_PRIORITY;

            try {
                const provider = new Provider(rpcEndpoint);
                // eslint-disable-next-line no-await-in-loop
                await provider.getNetwork();

                providers.push({
                    provider,
                    priority,
                    weight: 1,
                    stallTimeout: RPC_PROVIDER_STALL_TIMEOUT,
                });

                this.logger.debug(
                    `Connected to the blockchain RPC: ${this.maskRpcUrl(rpcEndpoint)}.`,
                );
            } catch (e) {
                this.logger.warn(
                    `Unable to connect to the blockchain RPC: ${this.maskRpcUrl(rpcEndpoint)}.`,
                );
            }
        }

        try {
            this.provider = new ethers.providers.FallbackProvider(
                providers,
                FALLBACK_PROVIDER_QUORUM,
            );

            // eslint-disable-next-line no-await-in-loop
            await this.providerReady();
        } catch (e) {
            throw new Error(
                `RPC Fallback Provider initialization failed. Fallback Provider quorum: ${FALLBACK_PROVIDER_QUORUM}. Error: ${e.message}.`,
            );
        }

        this.operationalWallets = this.getValidOperationalWallets();
        if (this.operationalWallets.length === 0) {
            throw Error(
                'Unable to initialize web3 service, all operational wallets provided are invalid',
            );
        }
    }

    getABIs() {
        return ABIs;
    }

    async initializeContracts() {
        this.contractAddresses = {};

        this.logger.info(
            `Initializing contracts with hub contract address: ${this.config.hubContractAddress}`,
        );
        this.HubContract = new ethers.Contract(
            this.config.hubContractAddress,
            this.getABIs().Hub,
            this.operationalWallets[0],
        );
        this.contractAddresses[this.config.hubContractAddress] = this.HubContract;

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

        await this.logBalances();
    }

    initializeProviderDebugging() {
        this.provider.on('debug', (info) => {
            const { method } = info.request;

            if (['call', 'estimateGas'].includes(method)) {
                const contractInstance = this.contractAddresses[info.request.params.transaction.to];
                const inputData = info.request.params.transaction.data;
                const decodedInputData = this._decodeInputData(
                    inputData,
                    contractInstance.interface,
                );
                const functionFragment = contractInstance.interface.getFunction(
                    inputData.slice(0, 10),
                );
                const functionName = functionFragment.name;
                const inputs = functionFragment.inputs
                    .map((input, i) => {
                        const argName = input.name;
                        const argValue = this._formatArgument(decodedInputData[i]);
                        return `${argName}=${argValue}`;
                    })
                    .join(', ');
                if (info.backend.error) {
                    const decodedErrorData = this._decodeErrorData(
                        info.backend.error,
                        contractInstance.interface,
                    );
                    this.logger.debug(
                        `${functionName}(${inputs})  ${method} has failed; Error: ${decodedErrorData}; ` +
                            `RPC: ${this.maskRpcUrl(info.backend.provider.connection.url)}.`,
                    );
                } else if (info.backend.result !== undefined) {
                    let message = `${functionName}(${inputs}) ${method} has been successfully executed; `;

                    if (info.backend.result !== null && method !== 'estimateGas') {
                        try {
                            const decodedResultData = this._decodeResultData(
                                inputData.slice(0, 10),
                                info.backend.result,
                                contractInstance.interface,
                            );
                            message += `Result: ${decodedResultData}; `;
                        } catch (error) {
                            this.logger.warn(
                                `Unable to decode result data for. Message: ${message}`,
                            );
                        }
                    }

                    message += `RPC: ${this.maskRpcUrl(info.backend.provider.connection.url)}.`;

                    this.logger.debug(message);
                }
            }
        });
    }

    maskRpcUrl(url) {
        if (url.includes('apiKey')) {
            return url.split('apiKey')[0];
        }
        return url;
    }

    initializeAssetStorageContract(assetStorageAddress) {
        this.assetStorageContracts[assetStorageAddress.toLowerCase()] = new ethers.Contract(
            assetStorageAddress,
            this.getABIs().ContentAssetStorage,
            this.operationalWallets[0],
        );
        this.contractAddresses[assetStorageAddress] =
            this.assetStorageContracts[assetStorageAddress.toLowerCase()];
    }

    initializeScoringContract(id, contractAddress) {
        const contractName = SCORING_FUNCTIONS[id];

        if (this.getABIs()[contractName] != null) {
            this.scoringFunctionsContracts[id] = new ethers.Contract(
                contractAddress,
                this.getABIs()[contractName],
                this.operationalWallets[0],
            );
            this.contractAddresses[contractAddress] = this.scoringFunctionsContracts[id];
        } else {
            this.logger.trace(
                `Skipping initialisation of contract with id: ${id}, address: ${contractAddress}`,
            );
        }
    }

    setContractCallCache(contractName, functionName, value) {
        if (CACHED_FUNCTIONS[contractName]?.[functionName]) {
            const type = CACHED_FUNCTIONS[contractName][functionName];
            if (!this.contractCallCache[contractName]) {
                this.contractCallCache[contractName] = {};
            }
            switch (type) {
                case CACHE_DATA_TYPES.NUMBER:
                    this.contractCallCache[contractName][functionName] = Number(value);
                    break;
                default:
                    this.contractCallCache[contractName][functionName] = value;
            }
        }
    }

    getContractCallCache(contractName, functionName) {
        if (
            CACHED_FUNCTIONS[contractName]?.[functionName] &&
            this.contractCallCache[contractName]?.[functionName]
        ) {
            return this.contractCallCache[contractName][functionName];
        }
        return null;
    }

    initializeContract(contractName, contractAddress) {
        if (this.getABIs()[contractName] != null) {
            this[`${contractName}Contract`] = new ethers.Contract(
                contractAddress,
                this.getABIs()[contractName],
                this.operationalWallets[0],
            );
            this.contractAddresses[contractAddress] = this[`${contractName}Contract`];
        } else {
            this.logger.trace(
                `Skipping initialisation of contract: ${contractName}, address: ${contractAddress}`,
            );
        }
    }

    async providerReady() {
        return this.provider.getNetwork();
    }

    getPublicKeys() {
        return this.operationalWallets.map((wallet) => wallet.address);
    }

    getManagementKey() {
        return this.config.evmManagementWalletPublicKey;
    }

    async logBalances() {
        for (const wallet of this.operationalWallets) {
            // eslint-disable-next-line no-await-in-loop
            const nativeBalance = await this.getNativeTokenBalance(wallet);
            // eslint-disable-next-line no-await-in-loop
            const tokenBalance = await this.getTokenBalance(wallet.address);
            this.logger.info(
                `Balance of ${wallet.address} is ${nativeBalance} ${this.baseTokenTicker} and ${tokenBalance} ${this.tracTicker}.`,
            );
        }
    }

    async getNativeTokenBalance(wallet) {
        const nativeBalance = await wallet.getBalance();
        return Number(ethers.utils.formatEther(nativeBalance));
    }

    async getTokenBalance(publicKey) {
        const tokenBalance = await this.callContractFunction(this.TokenContract, 'balanceOf', [
            publicKey,
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
        if (this.identityId) {
            return this.identityId;
        }

        const promises = this.operationalWallets.map((wallet) =>
            this.callContractFunction(
                this.IdentityStorageContract,
                'getIdentityId',
                [wallet.address],
                CONTRACTS.IDENTITY_STORAGE_CONTRACT,
            ).then((identityId) => [wallet.address, Number(identityId)]),
        );
        const results = await Promise.all(promises);

        this.identityId = 0;
        const walletWithIdentityZero = [];
        results.forEach(([publicKey, identityId]) => {
            this.logger.trace(
                `Identity id: ${identityId} found for wallet: ${publicKey} on blockchain: ${this.getBlockchainId()}`,
            );
            if (identityId !== 0) {
                if (this.identityId !== identityId && this.identityId !== 0) {
                    const index = this.operationalWallets.find(
                        (wallet) => wallet.address === publicKey,
                    );
                    this.operationalWallets.splice(index, 1);
                    this.logger.warn(
                        `Found invalid identity id. Identity id: ${identityId} found for wallet: ${publicKey}, expected identity id: ${
                            this.identityId
                        } on blockchain: ${this.getBlockchainId()}. Operational wallet will not be used for transactions.`,
                    );
                    this.removeTransactionQueue(publicKey);
                } else {
                    this.identityId = identityId;
                }
            } else {
                walletWithIdentityZero.push(publicKey);
            }
        });

        if (this.identityId !== 0) {
            walletWithIdentityZero.forEach((publicKey) => {
                const index = this.operationalWallets.find(
                    (wallet) => wallet.address === publicKey,
                );
                this.operationalWallets.splice(index, 1);
                this.logger.warn(
                    `Operational wallet: ${publicKey} don't have profile connected to it, expected identity id: ${
                        this.identityId
                    } on blockchain ${this.getBlockchainId()}`,
                );
            });
        }

        if (this.operationalWallets.length === 0) {
            throw new Error(
                `Unable to find valid operational wallets for blockchain implementation: ${this.getBlockchainId()}`,
            );
        }

        return this.identityId;
    }

    async identityIdExists() {
        const identityId = await this.getIdentityId();

        return !!identityId;
    }

    async createProfile(peerId) {
        if (!this.config.sharesTokenName || !this.config.sharesTokenSymbol) {
            throw new Error(
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
                await this._executeContractFunction(
                    this.ProfileContract,
                    'createProfile',
                    [
                        this.getManagementKey(),
                        this.getPublicKeys().slice(1),
                        this.convertAsciiToHex(peerId),
                        this.config.sharesTokenName,
                        this.config.sharesTokenSymbol,
                        this.config.operatorFee,
                    ],
                    null,
                    this.operationalWallets[0],
                );
                this.logger.info(
                    `Profile created with name: ${this.config.sharesTokenName} and symbol: ${
                        this.config.sharesTokenSymbol
                    }, wallet: ${
                        this.operationalWallets[0].address
                    }, on blockchain ${this.getBlockchainId()}`,
                );
                profileCreated = true;
            } catch (error) {
                if (error.message.includes('Profile already exists')) {
                    this.logger.info(
                        `Skipping profile creation, already exists on blockchain ${this.getBlockchainId()}.`,
                    );
                    profileCreated = true;
                } else if (retryCount + 1 < maxNumberOfRetries) {
                    retryCount += 1;
                    this.logger.warn(
                        `Unable to create profile. Will retry in ${retryDelayInSec}s. Retries left: ${
                            maxNumberOfRetries - retryCount
                        } on blockchain ${this.getBlockchainId()}. Error: ${error}`,
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

    async callContractFunction(contractInstance, functionName, args, contractName = null) {
        const maxNumberOfRetries = 3;
        const retryDelayInSec = 12;
        let retryCount = 0;
        let result = this.getContractCallCache(contractName, functionName);
        try {
            if (!result) {
                while (retryCount < maxNumberOfRetries) {
                    result = await contractInstance[functionName](...args);
                    const resultIsValid = Web3ServiceValidator.validateResult(
                        functionName,
                        contractName,
                        result,
                        this.logger,
                    );
                    if (resultIsValid) {
                        this.setContractCallCache(contractName, functionName, result);
                        return result;
                    }
                    if (retryCount === maxNumberOfRetries - 1) {
                        return null;
                    }
                    await sleep(retryDelayInSec * 1000);
                    retryCount += 1;
                }
            }
        } catch (error) {
            this._decodeContractCallError(contractInstance, functionName, error, args);
        }
        return result;
    }

    async _executeContractFunction(
        contractInstance,
        functionName,
        args,
        predefinedGasPrice,
        operationalWallet,
    ) {
        let result;
        const gasPrice = predefinedGasPrice ?? (await this.getGasPrice());
        let gasLimit;

        try {
            /* eslint-disable no-await-in-loop */
            gasLimit = await contractInstance.estimateGas[functionName](...args);
        } catch (error) {
            this._decodeEstimateGasError(contractInstance, functionName, error, args);
        }

        gasLimit = gasLimit ?? this.convertToWei(900, 'kwei');

        const gasLimitMultiplier = CONTRACT_FUNCTION_GAS_LIMIT_INCREASE_FACTORS[functionName] ?? 1;

        gasLimit = gasLimit.mul(gasLimitMultiplier * 100).div(100);

        this.logger.debug(
            `Sending signed transaction ${functionName} to the blockchain ${this.getBlockchainId()}` +
                ` with gas limit: ${gasLimit.toString()} and gasPrice ${gasPrice.toString()}. ` +
                `Transaction queue length: ${this.getTotalTransactionQueueLength()}. Wallet used: ${
                    operationalWallet.address
                }`,
        );

        const tx = await contractInstance.connect(operationalWallet)[functionName](...args, {
            gasPrice,
            gasLimit,
        });

        try {
            result = await this.provider.waitForTransaction(
                tx.hash,
                TRANSACTION_CONFIRMATIONS,
                TRANSACTION_POLLING_TIMEOUT_MILLIS,
            );

            if (result.status === 0) {
                await this.provider.call(tx, tx.blockNumber);
            }
        } catch (error) {
            this._decodeWaitForTxError(contractInstance, functionName, error, args);
        }
        return result;
    }

    _decodeEstimateGasError(contractInstance, functionName, error, args) {
        try {
            const decodedErrorData = this._decodeErrorData(error, contractInstance.interface);

            if (error.transaction === undefined) {
                throw new Error(
                    `Gas estimation for ${functionName} has failed, reason: ${decodedErrorData}`,
                );
            }

            const functionFragment = contractInstance.interface.getFunction(
                error.transaction.data.slice(0, 10),
            );
            const inputs = functionFragment.inputs
                .map((input, i) => {
                    const argName = input.name;
                    const argValue = this._formatArgument(args[i]);
                    return `${argName}=${argValue}`;
                })
                .join(', ');

            throw new Error(
                `Gas estimation for ${functionName}(${inputs}) has failed, reason: ${decodedErrorData}`,
            );
        } catch (decodeError) {
            this.logger.warn(`Unable to decode estimate gas error: ${decodeError}`);
            throw error;
        }
    }

    _decodeWaitForTxError(contractInstance, functionName, error, args) {
        try {
            const decodedErrorData = this._decodeErrorData(error, contractInstance.interface);

            let sigHash;
            if (error.transaction) {
                sigHash = error.transaction.data.slice(0, 10);
            } else {
                sigHash = this._getFunctionSighash(contractInstance, functionName, args);
            }

            const functionFragment = contractInstance.interface.getFunction(sigHash);
            const inputs = functionFragment.inputs
                .map((input, i) => {
                    const argName = input.name;
                    const argValue = this._formatArgument(args[i]);
                    return `${argName}=${argValue}`;
                })
                .join(', ');

            throw new Error(
                `Transaction ${functionName}(${inputs}) has been reverted, reason: ${decodedErrorData}`,
            );
        } catch (decodeError) {
            this.logger.warn(`Unable to decode wait for transaction error: ${decodeError}`);
            throw error;
        }
    }

    _decodeContractCallError(contractInstance, functionName, error, args) {
        try {
            const decodedErrorData = this._decodeErrorData(error, contractInstance.interface);

            const functionFragment = contractInstance.interface.getFunction(
                error.transaction.data.slice(0, 10),
            );
            const inputs = functionFragment.inputs
                .map((input, i) => {
                    const argName = input.name;
                    const argValue = this._formatArgument(args[i]);
                    return `${argName}=${argValue}`;
                })
                .join(', ');

            throw new Error(`Call ${functionName}(${inputs}) failed, reason: ${decodedErrorData}`);
        } catch (decodeError) {
            this.logger.warn(`Unable to decode contract call error: ${decodeError}`);
            throw error;
        }
    }

    _getFunctionSighash(contractInstance, functionName, args) {
        const functions = Object.keys(contractInstance.interface.functions)
            .filter((key) => contractInstance.interface.functions[key].name === functionName)
            .map((key) => ({ signature: key, ...contractInstance.interface.functions[key] }));

        for (const func of functions) {
            try {
                // Checks if given arguments can be encoded with function ABI inputs
                // may be useful for overloaded functions as it would help to find
                // needed function fragment
                ethers.utils.defaultAbiCoder.encode(func.inputs, args);

                const sighash = ethers.utils.hexDataSlice(
                    ethers.utils.keccak256(ethers.utils.toUtf8Bytes(func.signature)),
                    0,
                    4,
                );

                return sighash;
            } catch (error) {
                continue;
            }
        }

        throw new Error('No matching function signature found');
    }

    _getErrorData(error) {
        let nestedError = error;
        while (nestedError && nestedError.error) {
            nestedError = nestedError.error;
        }
        const errorData = nestedError.data;

        if (errorData === undefined) {
            throw error;
        }

        let returnData = typeof errorData === 'string' ? errorData : errorData.data;

        if (typeof returnData === 'object' && returnData.data) {
            returnData = returnData.data;
        }

        if (returnData === undefined || typeof returnData !== 'string') {
            throw error;
        }

        return returnData;
    }

    _decodeInputData(inputData, contractInterface) {
        if (inputData === ZERO_PREFIX) {
            return 'Empty input data.';
        }

        return contractInterface.decodeFunctionData(inputData.slice(0, 10), inputData);
    }

    _decodeErrorData(evmError, contractInterface) {
        let errorData;

        try {
            errorData = this._getErrorData(evmError);
        } catch (error) {
            return error.message;
        }

        // Handle empty error data
        if (errorData === ZERO_PREFIX) {
            return 'Empty error data.';
        }

        // Handle standard solidity string error
        if (errorData.startsWith(SOLIDITY_ERROR_STRING_PREFIX)) {
            const encodedReason = errorData.slice(SOLIDITY_ERROR_STRING_PREFIX.length);
            try {
                return ethers.utils.defaultAbiCoder.decode(['string'], `0x${encodedReason}`)[0];
            } catch (error) {
                return error.message;
            }
        }

        // Handle solidity panic code
        if (errorData.startsWith(SOLIDITY_PANIC_CODE_PREFIX)) {
            const encodedReason = errorData.slice(SOLIDITY_PANIC_CODE_PREFIX.length);
            let code;
            try {
                [code] = ethers.utils.defaultAbiCoder.decode(['uint256'], `0x${encodedReason}`);
            } catch (error) {
                return error.message;
            }

            return SOLIDITY_PANIC_REASONS[code] ?? 'Unknown Solidity panic code.';
        }

        // Try parsing a custom error using the contract ABI
        try {
            const decodedCustomError = contractInterface.parseError(errorData);
            const formattedArgs = decodedCustomError.errorFragment.inputs
                .map((input, i) => {
                    const argName = input.name;
                    const argValue = this._formatArgument(decodedCustomError.args[i]);
                    return `${argName}=${argValue}`;
                })
                .join(', ');
            return `custom error ${decodedCustomError.name}(${formattedArgs})`;
        } catch (error) {
            return `Failed to decode custom error data. Error: ${error}`;
        }
    }

    _decodeResultData(fragment, resultData, contractInterface) {
        if (resultData === ZERO_PREFIX) {
            return 'Empty input data.';
        }

        return contractInterface.decodeFunctionResult(fragment, resultData);
    }

    _formatArgument(value) {
        if (value === null || value === undefined) {
            return 'null';
        }

        if (typeof value === 'string') {
            return value;
        }

        if (typeof value === 'number' || BigNumber.isBigNumber(value)) {
            return value.toString();
        }

        if (Array.isArray(value)) {
            return `[${value.map((v) => this._formatArgument(v)).join(', ')}]`;
        }

        if (typeof value === 'object') {
            const formattedEntries = Object.entries(value).map(
                ([k, v]) => `${k}: ${this._formatArgument(v)}`,
            );
            return `{${formattedEntries.join(', ')}}`;
        }

        return value.toString();
    }

    async getTransaction(transactionHash) {
        return this.provider.getTransaction(transactionHash);
    }

    async getAllPastEvents(
        blockchainId,
        contractName,
        eventsToFilter,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        const contract = this[contractName];
        if (!contract) {
            // this will happen when we have different set of contracts on different blockchains
            // eg LinearSum contract is available on gnosis but not on NeuroWeb, so the node should not fetch events
            // from LinearSum contract on NeuroWeb blockchain
            return {
                events: [],
                lastCheckedBlock: currentBlock,
                eventsMissed: false,
            };
        }

        let fromBlock;
        let eventsMissed = false;
        if (this.startBlock - lastCheckedBlock > this.getMaxNumberOfHistoricalBlocksForSync()) {
            fromBlock = this.startBlock;
            eventsMissed = true;
        } else {
            fromBlock = lastCheckedBlock + 1;
        }

        const topics = [];
        for (const filterName in contract.filters) {
            if (!eventsToFilter.includes(filterName)) continue;
            const filter = contract.filters[filterName]().topics[0];
            topics.push(filter);
        }

        const events = [];
        let toBlock = currentBlock;
        try {
            while (fromBlock <= currentBlock) {
                toBlock = Math.min(
                    fromBlock + MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH - 1,
                    currentBlock,
                );
                const newEvents = await this.processBlockRange(
                    fromBlock,
                    toBlock,
                    contract,
                    topics,
                );
                newEvents.forEach((e) => events.push(...e));
                fromBlock = toBlock + 1;
            }
        } catch (error) {
            this.logger.warn(
                `Unable to process block range from: ${fromBlock} to: ${toBlock} for contract ${contractName} on blockchain: ${blockchainId}. Error: ${error.message}`,
            );
        }

        return {
            events: events.map((event) => ({
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
            })),
            lastCheckedBlock: toBlock,
            eventsMissed,
        };
    }

    getMaxNumberOfHistoricalBlocksForSync() {
        if (!this.maxNumberOfHistoricalBlocksForSync) {
            this.maxNumberOfHistoricalBlocksForSync = Math.round(
                MAX_BLOCKCHAIN_EVENT_SYNC_OF_HISTORICAL_BLOCKS_IN_MILLS / this.getBlockTimeMillis(),
            );
        }
        return this.maxNumberOfHistoricalBlocksForSync;
    }

    async processBlockRange(fromBlock, toBlock, contract, topics) {
        const newEvents = await Promise.all(
            topics.map((topic) => contract.queryFilter(topic, fromBlock, toBlock)),
        );
        return newEvents;
    }

    isOlderThan(timestamp, olderThanInMills) {
        if (!timestamp) return true;
        const timestampThirtyDaysInPast = new Date().getTime() - olderThanInMills;
        return timestamp < timestampThirtyDaysInPast;
    }

    async isAssetStorageContract(contractAddress) {
        return this.callContractFunction(this.HubContract, 'isAssetStorage(address)', [
            contractAddress,
        ]);
    }

    async getMinProofWindowOffsetPerc() {
        return this.callContractFunction(
            this.ParametersStorageContract,
            'minProofWindowOffsetPerc',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
    }

    async getMaxProofWindowOffsetPerc() {
        return this.callContractFunction(
            this.ParametersStorageContract,
            'maxProofWindowOffsetPerc',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
    }

    async generatePseudorandomUint8(assetCreator, blockNumber, blockTimestamp, limit) {
        const encodedData = ethers.utils.encodePacked(
            ['uint256', 'address', 'uint256'],
            [blockTimestamp, assetCreator, blockNumber],
        );
        const hash = ethers.utils.keccak256(encodedData);
        const hashBigNumber = BigNumber.from(hash);
        const hashModulo = hashBigNumber.mod(limit);

        return hashModulo.mod(256);
    }

    async getAssertionIdByIndex(assetContractAddress, tokenId, index) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toLowerCase()];
        if (!assetStorageContractInstance)
            throw new Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getAssertionIdByIndex', [
            tokenId,
            index,
        ]);
    }

    async getLatestAssertionId(assetContractAddress, tokenId) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance)
            throw new Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getLatestAssertionId', [
            tokenId,
        ]);
    }

    async getLatestTokenId(assetContractAddress) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance)
            throw new Error('Unknown asset storage contract address');

        const lastTokenId = await this.callContractFunction(
            assetStorageContractInstance,
            'lastTokenId',
            [],
        );
        return lastTokenId;
    }

    getAssetStorageContractAddresses() {
        return Object.keys(this.assetStorageContracts);
    }

    async getAssertionIds(assetContractAddress, tokenId) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance)
            throw new Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'getAssertionIds', [
            tokenId,
        ]);
    }

    async getKnowledgeAssetOwner(assetContractAddress, tokenId) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance)
            throw new Error('Unknown asset storage contract address');

        return this.callContractFunction(assetStorageContractInstance, 'ownerOf', [tokenId]);
    }

    async getUnfinalizedState(tokenId) {
        return this.callContractFunction(
            this.UnfinalizedStateStorageContract,
            'getUnfinalizedState',
            [tokenId],
        );
    }

    async getAgreementData(agreementId) {
        const result = await this.callContractFunction(
            this.ServiceAgreementStorageProxyContract,
            'getAgreementData',
            [agreementId],
        );
        if (!result) {
            return null;
        }
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

    async getAssertionData(assertionId) {
        const assertionData = await this.callContractFunction(
            this.AssertionStorageContract,
            'getAssertion',
            [assertionId],
        );
        return {
            timestamp: Number(assertionData.timestamp),
            size: Number(assertionData.size),
            triplesNumber: Number(assertionData.triplesNumber),
            chunksNumber: Number(assertionData.chunksNumber),
        };
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

    async getMinimumStake() {
        const minimumStake = await this.callContractFunction(
            this.ParametersStorageContract,
            'minimumStake',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );

        return Number(ethers.utils.formatEther(minimumStake));
    }

    async getMaximumStake() {
        const maximumStake = await this.callContractFunction(
            this.ParametersStorageContract,
            'maximumStake',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );

        return Number(ethers.utils.formatEther(maximumStake));
    }

    async getR2() {
        const r2 = await this.callContractFunction(
            this.ParametersStorageContract,
            'r2',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
        return r2;
    }

    async getR1() {
        const r1 = await this.callContractFunction(
            this.ParametersStorageContract,
            'r1',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
        return r1;
    }

    async getR0() {
        const r0 = await this.callContractFunction(
            this.ParametersStorageContract,
            'r0',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
        return r0;
    }

    async getFinalizationCommitsNumber() {
        const finalizationCommitsNumber = await this.callContractFunction(
            this.ParametersStorageContract,
            'finalizationCommitsNumber',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
        return finalizationCommitsNumber;
    }

    submitCommit(
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        closestNode,
        leftNeighborhoodEdge,
        rightNeighborhoodEdge,
        epoch,
        latestStateIndex,
        callback,
        gasPrice,
    ) {
        const submitCommitArgs = [assetContractAddress, tokenId, keyword, hashFunctionId, epoch];
        let functionName = 'submitCommit((address,uint256,bytes,uint8,uint16))';
        if (
            closestNode !== undefined &&
            leftNeighborhoodEdge !== undefined &&
            rightNeighborhoodEdge !== undefined
        ) {
            submitCommitArgs.push(closestNode, leftNeighborhoodEdge, rightNeighborhoodEdge);
            functionName =
                'submitCommit((address,uint256,bytes,uint8,uint16,uint72,uint72,uint72))';
        }
        return this.queueTransaction(
            this.selectCommitManagerContract(latestStateIndex),
            functionName,
            [submitCommitArgs],
            callback,
            gasPrice,
        );
    }

    submitUpdateCommit(
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        closestNode,
        leftNeighborhoodEdge,
        rightNeighborhoodEdge,
        epoch,
        callback,
        gasPrice,
    ) {
        const submitCommitArgs = [assetContractAddress, tokenId, keyword, hashFunctionId, epoch];
        let functionName = 'submitUpdateCommit((address,uint256,bytes,uint8,uint16))';
        if (
            closestNode !== undefined &&
            leftNeighborhoodEdge !== undefined &&
            rightNeighborhoodEdge !== undefined
        ) {
            submitCommitArgs.push(closestNode, leftNeighborhoodEdge, rightNeighborhoodEdge);
            functionName =
                'submitUpdateCommit((address,uint256,bytes,uint8,uint16,uint72,uint72,uint72))';
        }
        return this.queueTransaction(
            this.CommitManagerV1U1Contract,
            functionName,
            [submitCommitArgs],
            callback,
            gasPrice,
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
                ? [this.getPublicKeys()[0], assetContractAddress, tokenId, epoch]
                : [assetContractAddress, tokenId, epoch];

        const result = await this.callContractFunction(
            this.selectProofManagerContract(latestStateIndex),
            'getChallenge',
            args,
        );

        return { assertionId: result['0'], challenge: result['1'] };
    }

    sendProof(
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        proof,
        chunkHash,
        latestStateIndex,
        callback,
        gasPrice,
    ) {
        return this.queueTransaction(
            this.selectProofManagerContract(latestStateIndex),
            'sendProof',
            [[assetContractAddress, tokenId, keyword, hashFunctionId, epoch, proof, chunkHash]],
            callback,
            gasPrice,
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
        return ethers.utils.keccak256(bytesLikeData);
    }

    sha256(bytesLikeData) {
        return ethers.utils.sha256(bytesLikeData);
    }

    encodePacked(types, values) {
        return ethers.utils.solidityPack(types, values);
    }

    convertUint8ArrayToHex(uint8Array) {
        return ethers.utils.hexlify(uint8Array);
    }

    convertAsciiToHex(string) {
        return this.convertUint8ArrayToHex(ethers.utils.toUtf8Bytes(string));
    }

    convertHexToAscii(hexString) {
        return ethers.utils.toUtf8String(hexString);
    }

    convertBytesToUint8Array(bytesLikeData) {
        return ethers.utils.arrayify(bytesLikeData);
    }

    convertToWei(value, fromUnit = 'ether') {
        return ethers.utils.parseUnits(value.toString(), fromUnit);
    }

    convertFromWei(value, toUnit = 'ether') {
        return ethers.utils.formatUnits(value, toUnit);
    }

    async healthCheck() {
        try {
            const gasPrice = await this.operationalWallets[0].getGasPrice();
            if (gasPrice) return true;
        } catch (e) {
            this.logger.error(`Error on checking blockchain. ${e}`);
            return false;
        }
        return false;
    }

    async restartService() {
        await this.initializeWeb3();
        await this.initializeContracts();
    }

    async getUpdateCommitWindowDuration() {
        const commitWindowDurationPerc = await this.callContractFunction(
            this.ParametersStorageContract,
            'updateCommitWindowDuration',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
        return Number(commitWindowDurationPerc);
    }

    async getCommitWindowDurationPerc() {
        const commitWindowDurationPerc = await this.callContractFunction(
            this.ParametersStorageContract,
            'commitWindowDurationPerc',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
        return Number(commitWindowDurationPerc);
    }

    async getProofWindowDurationPerc() {
        return this.callContractFunction(
            this.ParametersStorageContract,
            'proofWindowDurationPerc',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
    }

    async getEpochLength() {
        const epochLength = await this.callContractFunction(
            this.ParametersStorageContract,
            'epochLength',
            [],
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
        );
        return Number(epochLength);
    }

    async isHashFunction(hashFunctionId) {
        return this.callContractFunction(this.HashingProxyContract, 'isHashFunction(uint8)', [
            hashFunctionId,
        ]);
    }

    getScoreFunctionIds() {
        return Object.keys(this.scoringFunctionsContracts);
    }

    async getLog2PLDSFParams() {
        const log2pldsfParams = await this.callContractFunction(
            this.scoringFunctionsContracts[1],
            'getParameters',
            [],
            CONTRACTS.LOG2PLDSF_CONTRACT,
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

    async getAgreementScoreFunctionId(agreementId) {
        return this.callContractFunction(
            this.ServiceAgreementStorageProxyContract,
            'getAgreementScoreFunctionId',
            [agreementId],
        );
    }

    async getLinearSumParams() {
        const linearSumParams = await this.callContractFunction(
            this.scoringFunctionsContracts[2],
            'getParameters',
            [],
            CONTRACTS.LINEAR_SUM_CONTRACT,
        );
        return {
            distanceScaleFactor: BigNumber.from(linearSumParams[0]),
            stakeScaleFactor: BigNumber.from(linearSumParams[1]),
            w1: Number(linearSumParams[2]),
            w2: Number(linearSumParams[3]),
        };
    }

    async getParanetKnowledgeAssetsCount(paranetId) {
        return this.callContractFunction(
            this.ParanetsRegistryContract,
            'getKnowledgeAssetsCount',
            [paranetId],
            CONTRACTS.PARANETS_REGISTRY_CONTRACT,
        );
    }

    async getParanetKnowledgeAssetsWithPagination(paranetId, offset, limit) {
        return this.callContractFunction(
            this.ParanetsRegistryContract,
            'getKnowledgeAssetsWithPagination',
            [paranetId, offset, limit],
            CONTRACTS.PARANETS_REGISTRY_CONTRACT,
        );
    }

    async getParanetMetadata(paranetId) {
        return this.callContractFunction(
            this.ParanetsRegistryContract,
            'getParanetMetadata',
            [paranetId],
            CONTRACTS.PARANETS_REGISTRY_CONTRACT,
        );
    }

    async getName(paranetId) {
        return this.callContractFunction(
            this.ParanetsRegistryContract,
            'getName',
            [paranetId],
            CONTRACTS.PARANETS_REGISTRY_CONTRACT,
        );
    }

    async getDescription(paranetId) {
        return this.callContractFunction(
            this.ParanetsRegistryContract,
            'getDescription',
            [paranetId],
            CONTRACTS.PARANETS_REGISTRY_CONTRACT,
        );
    }

    async getParanetKnowledgeAssetLocator(knowledgeAssetId) {
        const [knowledgeAssetStorageContract, kaTokenId] = await this.callContractFunction(
            this.ParanetKnowledgeAssetsRegistryContract,
            'getKnowledgeAssetLocator',
            [knowledgeAssetId],
        );
        const tokenId = kaTokenId.toNumber();
        const knowledgeAssetLocator = { knowledgeAssetStorageContract, tokenId };
        return knowledgeAssetLocator;
    }

    async getKnowledgeAssetLocatorFromParanetId(paranetId) {
        const [paranetKAStorageContract, paranetKATokenId] = await this.callContractFunction(
            this.ParanetsRegistryContract,
            'getParanetKnowledgeAssetLocator',
            [paranetId],
        );
        const tokenId = paranetKATokenId.toNumber();
        const knowledgeAssetLocator = { paranetKAStorageContract, tokenId };
        return knowledgeAssetLocator;
    }

    async paranetExists(paranetId) {
        return this.callContractFunction(
            this.ParanetsRegistryContract,
            'paranetExists',
            [paranetId],
            CONTRACTS.PARANETS_REGISTRY_CONTRACT,
        );
    }

    async getParanetId(knowledgeAssetId) {
        return this.callContractFunction(
            this.ParanetKnowledgeAssetsRegistryContract,
            'getParanetId',
            [knowledgeAssetId],
        );
    }

    async isParanetKnowledgeAsset(knowledgeAssetId) {
        return this.callContractFunction(
            this.ParanetKnowledgeAssetsRegistryContract,
            'isParanetKnowledgeAsset',
            [knowledgeAssetId],
        );
    }

    async isCuratedNode(paranetId, identityId) {
        return this.callContractFunction(this.ParanetsRegistryContract, 'isCuratedNode', [
            paranetId,
            identityId,
        ]);
    }

    async getNodesAccessPolicy(paranetId) {
        return this.callContractFunction(this.ParanetsRegistryContract, 'getNodesAccessPolicy', [
            paranetId,
        ]);
    }

    async getParanetCuratedNodes(paranetId) {
        return this.callContractFunction(
            this.ParanetsRegistryContract,
            'getCuratedNodes',
            [paranetId],
            CONTRACTS.PARANETS_REGISTRY_CONTRACT,
        );
    }

    async getNodeAddress(identityId) {
        return this.callContractFunction(this.ProfileStorageContract, 'getNodeId', [identityId]);
    }
}

export default Web3Service;
