/* eslint-disable no-await-in-loop */
import ethers from 'ethers';
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
} from '../../../../constants/constants.js';

class OtEthers extends BlockchainEventsService {
    async initialize(config, logger) {
        await super.initialize(config, logger);
        await this.initializeRpcProviders();
    }

    async initializeRpcProviders() {
        this.providers = {};
        for (const blockchain of Object.keys(this.config.rpcEndpoints)) {
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

    async getPastEvents(
        blockchain,
        contractName,
        contract,
        eventsToFilter,
        lastCheckedBlock,
        currentBlock,
    ) {
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
        const olderBlock = await this.getBlock(latestBlock.number - blockRange);

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
