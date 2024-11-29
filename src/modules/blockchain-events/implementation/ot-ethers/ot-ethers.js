/* eslint-disable no-await-in-loop */
import { ethers, BigNumber } from 'ethers';
import { setTimeout as sleep } from 'timers/promises';
import BlockchainEventsService from '../blockchain-events-service.js';

import {
    MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH,
    WS_RPC_PROVIDER_PRIORITY,
    HTTP_RPC_PROVIDER_PRIORITY,
    FALLBACK_PROVIDER_QUORUM,
    RPC_PROVIDER_STALL_TIMEOUT,
    MAX_BLOCKCHAIN_EVENT_SYNC_OF_HISTORICAL_BLOCKS_IN_MILLS,
    NODE_ENVIRONMENTS,
    BLOCK_TIME_MILLIS,
    ABIs,
    CACHED_FUNCTIONS,
    SOLIDITY_ERROR_STRING_PREFIX,
    SOLIDITY_PANIC_CODE_PREFIX,
    SOLIDITY_PANIC_REASONS,
    ZERO_PREFIX,
    CACHE_DATA_TYPES,
} from '../../../../constants/constants.js';
import Web3ServiceValidator from './web3-service-validator.js';

class OtEthers extends BlockchainEventsService {
    async initialize(config, logger) {
        await super.initialize(config, logger);
        this.contractCallCache = {};
        await this.initializeRpcProviders();
        await this.initializeContracts();
    }

    async initializeRpcProviders() {
        this.providers = {};
        this.operationalWallets = {};

        for (const blockchain of this.config.blockchains) {
            const providers = [];
            for (const rpcEndpoint of this.config.rpcEndpoints[blockchain]) {
                const isWebSocket = rpcEndpoint.startsWith('ws');
                const Provider = isWebSocket
                    ? ethers.providers.WebSocketProvider
                    : ethers.providers.JsonRpcProvider;
                const priority = isWebSocket
                    ? WS_RPC_PROVIDER_PRIORITY
                    : HTTP_RPC_PROVIDER_PRIORITY;

                try {
                    const provider = new Provider(rpcEndpoint);
                    // eslint-disable-next-line no-await-in-loop
                    await provider.getNetwork();

                    let isArchiveNode = false;
                    try {
                        const block = await provider.getBlock(1);

                        if (block) {
                            isArchiveNode = true;
                        }
                    } catch (error) {
                        /* empty */
                    }

                    if (isArchiveNode) {
                        providers.push({
                            provider,
                            priority,
                            weight: 1,
                            stallTimeout: RPC_PROVIDER_STALL_TIMEOUT,
                        });
                    } else {
                        this.logger.warn(`${rpcEndpoint} RPC is not an Archive Node, skipping...`);
                        continue;
                    }

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
                this.providers[blockchain] = new ethers.providers.FallbackProvider(
                    providers,
                    FALLBACK_PROVIDER_QUORUM,
                );

                // eslint-disable-next-line no-await-in-loop
                await this.providers[blockchain].getNetwork();
            } catch (e) {
                throw new Error(
                    `RPC Fallback Provider initialization failed. Fallback Provider quorum: ${FALLBACK_PROVIDER_QUORUM}. Error: ${e.message}.`,
                );
            }

            this.operationalWallets[blockchain] = this.getValidOperationalWallets(blockchain);
            if (this.operationalWallets.length === 0) {
                throw Error(
                    'Unable to initialize web3 service, all operational wallets provided are invalid',
                );
            }
        }
    }

    maskRpcUrl(url) {
        if (url.includes('apiKey')) {
            return url.split('apiKey')[0];
        }
        return url;
    }

    async getBlock(blockchain, tag = 'latest') {
        return this.providers[blockchain].getBlock(tag);
    }

    getValidOperationalWallets(blockchain) {
        const wallets = [];
        this.config.operationalWallets[blockchain].forEach((wallet) => {
            try {
                wallets.push(new ethers.Wallet(wallet.privateKey, this.providers[blockchain]));
            } catch (error) {
                this.logger.warn(
                    `Invalid evm private key, unable to create wallet instance. Wallet public key: ${wallet.evmAddress}. Error: ${error.message}`,
                );
            }
        });
        return wallets;
    }

    async initializeContracts() {
        this.contracts = {};
        this.contractAddresses = {};
        this.scoringFunctionsContracts = {};
        this.assetStorageContracts = {};

        for (const blockchain of this.config.blockchains) {
            this.contracts[blockchain] = {};
            this.contractAddresses[blockchain] = {};

            this.logger.info(
                `Initializing contracts with hub contract address: ${this.config.hubContractAddress[blockchain]}`,
            );
            this.contracts[blockchain].HubContract = new ethers.Contract(
                this.config.hubContractAddress[blockchain],
                this.getABIs().Hub,
                this.operationalWallets[blockchain][0],
            );
            this.contractAddresses[blockchain][this.config.hubContractAddress] =
                this.contracts[blockchain].HubContract;

            const contractsArray = await this.callContractFunction(
                blockchain,
                this.contracts[blockchain].HubContract,
                'getAllContracts',
                [],
            );

            // Filter contracts that we want to monitor events for
            const eventsContracts = this.contractsToMonitor.map((contractName) =>
                contractName.endsWith('Contract')
                    ? contractName.slice(0, -'Contract'.length)
                    : contractName,
            );

            const filteredContracts = contractsArray.filter(([contractName]) =>
                eventsContracts.includes(contractName),
            );

            filteredContracts.forEach(([contractName, contractAddress]) => {
                this.initializeContract(blockchain, contractName, contractAddress);
            });

            this.logger.info(`Contracts initialized`);
        }
    }

    getABIs() {
        return ABIs;
    }

    initializeContract(blockchain, contractName, contractAddress) {
        if (this.getABIs()[contractName] != null) {
            this.contracts[blockchain][`${contractName}Contract`] = new ethers.Contract(
                contractAddress,
                this.getABIs()[contractName],
                this.operationalWallets[blockchain][0],
            );
            this.contractAddresses[blockchain][contractAddress] =
                this.contracts[blockchain][`${contractName}Contract`];
        } else {
            this.logger.trace(
                `Skipping initialisation of contract: ${contractName}, address: ${contractAddress}`,
            );
        }
    }

    async callContractFunction(
        blockchain,
        contractInstance,
        functionName,
        args,
        contractName = null,
    ) {
        const maxNumberOfRetries = 3;
        const retryDelayInSec = 12;
        let retryCount = 0;
        let result = this.getContractCallCache(blockchain, contractName, functionName);
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
                        this.setContractCallCache(blockchain, contractName, functionName, result);
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

    getContractCallCache(blockchain, contractName, functionName) {
        if (
            CACHED_FUNCTIONS[contractName]?.[functionName] &&
            this.contractCallCache[blockchain][contractName]?.[functionName]
        ) {
            return this.contractCallCache[blockchain][contractName][functionName];
        }
        return null;
    }

    setContractCallCache(blockchain, contractName, functionName, value) {
        if (CACHED_FUNCTIONS[contractName]?.[functionName]) {
            const type = CACHED_FUNCTIONS[contractName][functionName];
            if (!this.contractCallCache[blockchain][contractName]) {
                this.contractCallCache[blockchain][contractName] = {};
            }
            switch (type) {
                case CACHE_DATA_TYPES.NUMBER:
                    this.contractCallCache[blockchain][contractName][functionName] = Number(value);
                    break;
                default:
                    this.contractCallCache[blockchain][contractName][functionName] = value;
            }
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

    async getPastEvents(blockchain, contractName, eventsToFilter, lastCheckedBlock, currentBlock) {
        const contract = this.contracts[blockchain][contractName];
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
        if (
            currentBlock - lastCheckedBlock >
            (await this._getMaxNumberOfHistoricalBlocksForSync(blockchain))
        ) {
            fromBlock = currentBlock;
            eventsMissed = true;
        } else {
            fromBlock = lastCheckedBlock + 1;
        }

        const topics = [];
        for (const filterName in contract.filters) {
            if (!eventsToFilter.includes(filterName)) {
                continue;
            }
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
                const newEvents = await this._processBlockRange(
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
                `Unable to process block range from: ${fromBlock} to: ${toBlock} for contract ${contractName} on blockchain: ${blockchain}. Error: ${error.message}`,
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
                blockchain,
            })),
            lastCheckedBlock: toBlock,
            eventsMissed,
        };
    }

    async _getMaxNumberOfHistoricalBlocksForSync(blockchain) {
        if (!this.maxNumberOfHistoricalBlocksForSync) {
            const blockTimeMillis = await this._getBlockTimeMillis(blockchain);

            this.maxNumberOfHistoricalBlocksForSync = Math.round(
                MAX_BLOCKCHAIN_EVENT_SYNC_OF_HISTORICAL_BLOCKS_IN_MILLS / blockTimeMillis,
            );
        }
        return this.maxNumberOfHistoricalBlocksForSync;
    }

    async _getBlockTimeMillis(blockchain, blockRange = 1000) {
        if (
            [NODE_ENVIRONMENTS.DEVELOPMENT, NODE_ENVIRONMENTS.TEST].includes(process.env.NODE_ENV)
        ) {
            return BLOCK_TIME_MILLIS.HARDHAT;
        }

        const latestBlock = await this.getBlock(blockchain);
        const olderBlock = await this.getBlock(blockchain, latestBlock.number - blockRange);

        const timeDiffMillis = (latestBlock.timestamp - olderBlock.timestamp) * 1000;
        return timeDiffMillis / blockRange;
    }

    async _processBlockRange(fromBlock, toBlock, contract, topics) {
        const newEvents = await Promise.all(
            topics.map((topic) => contract.queryFilter(topic, fromBlock, toBlock)),
        );
        return newEvents;
    }
}

export default OtEthers;
