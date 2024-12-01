/* eslint-disable no-await-in-loop */
import { ethers } from 'ethers';
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
    CONTRACTS_EVENTS_LISTENED,
} from '../../../../constants/constants.js';

class OtEthers extends BlockchainEventsService {
    async initialize(config, logger) {
        await super.initialize(config, logger);
        this.contractCallCache = {};
        await this._initializeRpcProviders();
        await this._initializeContracts();
    }

    async _initializeRpcProviders() {
        this.providers = {};

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
                        `Connected to the blockchain RPC: ${
                            rpcEndpoint.includes('apiKey')
                                ? rpcEndpoint.split('apiKey')[0]
                                : rpcEndpoint
                        }.`,
                    );
                } catch (e) {
                    this.logger.warn(
                        `Unable to connect to the blockchain RPC: ${
                            rpcEndpoint.includes('apiKey')
                                ? rpcEndpoint.split('apiKey')[0]
                                : rpcEndpoint
                        }.`,
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
        }
    }

    async _initializeContracts() {
        this.contracts = {};

        for (const blockchain of this.config.blockchains) {
            this.contracts[blockchain] = {};

            this.logger.info(
                `Initializing contracts with hub contract address: ${this.config.hubContractAddress[blockchain]}`,
            );
            this.contracts[blockchain].Hub = new ethers.Contract(
                this.config.hubContractAddress[blockchain],
                ABIs.Hub,
                this.providers[blockchain],
            );

            const contractsAray = await this.contracts[blockchain].Hub.getAllContracts();
            const assetStoragesArray = await this.contracts[blockchain].Hub.getAllAssetStorages();

            const allContracts = [...contractsAray, ...assetStoragesArray];

            for (const [contractName, contractAddress] of allContracts) {
                if (
                    CONTRACTS_EVENTS_LISTENED.includes(contractName) &&
                    ABIs[contractName] != null
                ) {
                    this.contracts[blockchain][contractName] = new ethers.Contract(
                        contractAddress,
                        ABIs[contractName],
                        this.providers[blockchain],
                    );
                }
            }

            this.logger.info(`Contracts initialized`);
        }
    }

    async getBlock(blockchain, tag) {
        return this.providers[blockchain].getBlock(tag);
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

        const maxBlocksToSync = await this._getMaxNumberOfHistoricalBlocksForSync(blockchain);
        let fromBlock =
            currentBlock - lastCheckedBlock > maxBlocksToSync ? currentBlock : lastCheckedBlock + 1;
        const eventsMissed = currentBlock - lastCheckedBlock > maxBlocksToSync;

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
                events.push(...newEvents.flat());
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
