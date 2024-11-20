/* eslint-disable no-await-in-loop */
import { ethers } from 'ethers';

import {
    MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH,
    BLOCK_TIME_MILLIS,
    WS_RPC_PROVIDER_PRIORITY,
    HTTP_RPC_PROVIDER_PRIORITY,
    FALLBACK_PROVIDER_QUORUM,
    RPC_PROVIDER_STALL_TIMEOUT,
    MAX_BLOCKCHAIN_EVENT_SYNC_OF_HISTORICAL_BLOCKS_IN_MILLS,
} from '../../../constants/constants.js';

class OtEventListener {
    async initialize(config, logger) {
        this.logger = logger;
        this.config = config;
    }

    async initializeAndStartEventListener() {
        throw Error('initializeAndStartEventListener not implemented');
    }

    async initializeWeb3(blockchainConfig) {
        this.blockchainConfig = blockchainConfig;
        const providers = [];
        for (const rpcEndpoint of this.blockchainConfig.rpcEndpoints) {
            const isWebSocket = rpcEndpoint.startsWith('ws');
            const Provider = isWebSocket
                ? ethers.providers.WebSocketProvider
                : ethers.providers.JsonRpcProvider;
            const priority = isWebSocket ? WS_RPC_PROVIDER_PRIORITY : HTTP_RPC_PROVIDER_PRIORITY;

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

    async getBlockNumber() {
        const latestBlock = await this.provider.getBlock('latest');
        return latestBlock.number;
    }

    getBlockTimeMillis() {
        return BLOCK_TIME_MILLIS.DEFAULT;
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

    maskRpcUrl(url) {
        if (url.includes('apiKey')) {
            return url.split('apiKey')[0];
        }
        return url;
    }

    async providerReady() {
        return this.provider.getNetwork();
    }

    getValidOperationalWallets() {
        const wallets = [];
        this.blockchainConfig.operationalWallets.forEach((wallet) => {
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
}

export default OtEventListener;
