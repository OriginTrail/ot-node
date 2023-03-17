import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    CONTRACTS,
    CONTRACT_EVENT_FETCH_INTERVALS,
    TRIPLE_STORE_REPOSITORIES,
    NODE_ENVIRONMENTS,
    PENDING_STORAGE_REPOSITORIES,
} from '../constants/constants.js';

const MAXIMUM_FETCH_EVENTS_FAILED_COUNT = 5;
const fetchEventsFailedCount = {};

class BlockchainEventListenerService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.ualService = ctx.ualService;
    }

    initialize() {
        for (const blockchainId of this.blockchainModuleManager.getImplementationNames()) {
            this.listenOnBlockchainEvents(blockchainId);
            this.logger.info(`Event listener initialized for blockchain: '${blockchainId}'.`);
        }
    }

    listenOnBlockchainEvents(blockchainId) {
        const devEnvironment =
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

        const eventFetchInterval = devEnvironment
            ? CONTRACT_EVENT_FETCH_INTERVALS.DEVELOPMENT
            : CONTRACT_EVENT_FETCH_INTERVALS.MAINNET;

        let working = false;
        fetchEventsFailedCount[blockchainId] = 0;
        const fetchEventInterval = setInterval(async () => {
            if (working) return;
            try {
                working = true;
                const currentBlock = await this.blockchainModuleManager.getBlockNumber();
                const syncContractEventsPromises = [
                    this.getContractEvents(
                        blockchainId,
                        CONTRACTS.SHARDING_TABLE_CONTRACT,
                        currentBlock,
                    ),
                    this.getContractEvents(blockchainId, CONTRACTS.STAKING_CONTRACT, currentBlock),
                    this.getContractEvents(blockchainId, CONTRACTS.PROFILE_CONTRACT, currentBlock),
                    this.getContractEvents(
                        blockchainId,
                        CONTRACTS.COMMIT_MANAGER_V1_U1_CONTRACT,
                        currentBlock,
                    ),
                ];

                if (!devEnvironment) {
                    syncContractEventsPromises.push(
                        this.getContractEvents(blockchainId, CONTRACTS.HUB_CONTRACT, currentBlock),
                    );
                }
                const contractEvents = await Promise.all(syncContractEventsPromises);

                await this.handleBlockchainEvents(contractEvents.flatMap((events) => events));
                fetchEventsFailedCount[blockchainId] = 0;
            } catch (e) {
                if (fetchEventsFailedCount[blockchainId] >= MAXIMUM_FETCH_EVENTS_FAILED_COUNT) {
                    clearInterval(fetchEventInterval);
                    this.blockchainModuleManager.removeImplementation(blockchainId);
                    if (!this.blockchainModuleManager.getImplementationNames().length) {
                        this.logger.error(
                            `Unable to fetch new events for blockchain: ${blockchainId}. Error message: ${e.message} OT-node shutting down...`,
                        );
                        process.exit(1);
                    }
                    this.logger.error(
                        `Unable to fetch new events for blockchain: ${blockchainId}. Error message: ${e.message} blockchain implementation removed.`,
                    );
                }
                this.logger.error(
                    `Failed to get and process blockchain events for blockchain: ${blockchainId}. Error: ${e}`,
                );
                fetchEventsFailedCount[blockchainId] += 1;
            } finally {
                working = false;
            }
        }, eventFetchInterval);
    }

    async getContractEvents(blockchainId, contractName, currentBlock) {
        const lastCheckedBlockObject = await this.repositoryModuleManager.getLastCheckedBlock(
            blockchainId,
            contractName,
        );
        const events = await this.blockchainModuleManager.getAllPastEvents(
            blockchainId,
            contractName,
            lastCheckedBlockObject?.last_checked_block ?? 0,
            lastCheckedBlockObject?.last_checked_timestamp ?? 0,
            currentBlock,
        );

        await this.repositoryModuleManager.updateLastCheckedBlock(
            blockchainId,
            currentBlock,
            Date.now(0),
            contractName,
        );

        return events;
    }

    async handleBlockchainEvents(events) {
        if (events?.length) {
            this.logger.trace(`${events.length} blockchain events caught.`);
            const insertedEvents = await this.repositoryModuleManager.insertBlockchainEvents(
                events,
            );
            insertedEvents.sort((event1, event2) => event1.block - event2.block);

            let handleBlockEventsPromises = [];
            let currentBlock = 0;
            for (const event of insertedEvents) {
                if (event.block !== currentBlock) {
                    // eslint-disable-next-line no-await-in-loop
                    await Promise.all(handleBlockEventsPromises);
                    handleBlockEventsPromises = [];
                    currentBlock = event.block;
                }
                handleBlockEventsPromises.push(this.handleBlockchainEvent(event));
            }
            await Promise.all(handleBlockEventsPromises);
        }
    }

    async handleBlockchainEvent(event) {
        const handlerFunctionName = `handle${event.event}Event`;
        if (!this[handlerFunctionName]) return;
        this.logger.trace(`${event.event} event caught.`);
        await this[handlerFunctionName](event);
        await this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
    }

    async handleNewContractEvent(event) {
        await this.reinitializeContracts(event.blockchain_id);
    }

    async handleContractChangedEvent(event) {
        await this.reinitializeContracts(event.blockchain_id);
        if (event.contractName === CONTRACTS.SHARDING_TABLE_CONTRACT) {
            await this.repositoryModuleManager.cleanShardingTable();
        }
    }

    async handleNewAssetStorageEvent(event) {
        await this.reinitializeContracts(event.blockchain_id);
    }

    async handleAssetStorageChangedEvent(event) {
        await this.reinitializeContracts(event.blockchain_id);
    }

    async handleNodeAddedEvent(event) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain_id,
            eventData.nodeId,
        );

        const nodeIdSha256 = await this.validationModuleManager.callHashFunction(
            // TODO: How to add more hashes?
            CONTENT_ASSET_HASH_FUNCTION_ID,
            nodeId,
        );

        this.logger.trace(`Adding peer id: ${nodeId} to sharding table.`);

        await this.repositoryModuleManager.createPeerRecord(
            nodeId,
            event.blockchain_id,
            this.blockchainModuleManager.convertFromWei(event.blockchain_id, eventData.ask),
            this.blockchainModuleManager.convertFromWei(event.blockchain_id, eventData.stake),
            new Date(0),
            nodeIdSha256,
        );
    }

    async handleNodeRemovedEvent(event) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain_id,
            eventData.nodeId,
        );

        this.logger.trace(`Removing peer id: ${nodeId} from sharding table.`);

        await this.repositoryModuleManager.removePeerRecord(event.blockchain_id, nodeId);
    }

    async handleStakeIncreasedEvent(event) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain_id,
            eventData.nodeId,
        );

        this.logger.trace(`Updating stake value for peer id: ${nodeId} in sharding table.`);

        await this.repositoryModuleManager.updatePeerStake(
            event.blockchain_id,
            nodeId,
            this.blockchainModuleManager.convertFromWei(
                event.blockchain_id,
                await this.blockchainModuleManager.getNodeStake(
                    event.blockchain_id,
                    eventData.identityId,
                ),
            ),
        );
    }

    async handleStakeWithdrawalStartedEvent(event) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain_id,
            eventData.nodeId,
        );

        this.logger.trace(`Updating stake value for peer id: ${nodeId} in sharding table.`);

        await this.repositoryModuleManager.updatePeerStake(
            event.blockchain_id,
            nodeId,
            this.blockchainModuleManager.convertFromWei(
                event.blockchain_id,
                await this.blockchainModuleManager.getNodeStake(
                    event.blockchain_id,
                    eventData.identityId,
                ),
            ),
        );
    }

    async handleAskUpdatedEvent(event) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain_id,
            eventData.nodeId,
        );

        this.logger.trace(`Updating ask value for peer id: ${nodeId} in sharding table.`);

        await this.repositoryModuleManager.updatePeerAsk(
            event.blockchain_id,
            nodeId,
            this.blockchainModuleManager.convertFromWei(event.blockchain_id, eventData.ask),
        );
    }

    async handleStateFinalizedEvent(event) {
        const eventData = JSON.parse(event.data);

        const { tokenId, keyword, state } = eventData;
        const blockchain = event.blockchain_id;
        const contract = eventData.assetContract;

        await Promise.all([
            this._handleStateFinalizedEvent(
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                PENDING_STORAGE_REPOSITORIES.PUBLIC,
                blockchain,
                contract,
                tokenId,
                keyword,
                state,
            ),
            this._handleStateFinalizedEvent(
                TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                TRIPLE_STORE_REPOSITORIES.PRIVATE_HISTORY,
                PENDING_STORAGE_REPOSITORIES.PRIVATE,
                blockchain,
                contract,
                tokenId,
                keyword,
                state,
            ),
        ]);
    }

    async _handleStateFinalizedEvent(
        currentRepository,
        historyRepository,
        pendingRepository,
        blockchain,
        contract,
        tokenId,
        keyword,
        assertionId,
    ) {
        const assetMetadata = await this.tripleStoreService.getAssetMetadata(
            currentRepository,
            blockchain,
            contract,
            tokenId,
        );

        if (assetMetadata.length) {
            // if asset exists in current repository
            await Promise.all(
                assetMetadata.map(({ assertion, agreementStartTime, agreementEndTime }) =>
                    this.tripleStoreService.moveAsset(
                        currentRepository,
                        historyRepository,
                        assertion.replace('assertion:', ''),
                        blockchain,
                        contract,
                        tokenId,
                        agreementStartTime,
                        agreementEndTime,
                        keyword,
                    ),
                ),
            );
            // delete asset metadata from current repository
            await this.tripleStoreService.deleteAssetMetadata(
                currentRepository,
                blockchain,
                contract,
                tokenId,
            );
        }

        const cachedData = await this.pendingStorageService.getCachedAssertion(
            pendingRepository,
            blockchain,
            contract,
            tokenId,
        );

        const storePromises = [];
        if (cachedData?.public?.assertion) {
            // insert public assertion in current repository
            storePromises.push(
                this.tripleStoreService.localStoreAsset(
                    currentRepository,
                    assertionId,
                    cachedData.public.assertion,
                    blockchain,
                    contract,
                    tokenId,
                    cachedData.agreementStartTime,
                    cachedData.agreementEndTime,
                    keyword,
                ),
            );
        }

        if (cachedData?.private?.assertion && cachedData?.private?.assertionId) {
            // insert private assertion in current repository
            storePromises.push(
                await this.tripleStoreService.localStoreAsset(
                    currentRepository,
                    cachedData.private.assertionId,
                    cachedData.private.assertion,
                    blockchain,
                    contract,
                    tokenId,
                    cachedData.agreementStartTime,
                    cachedData.agreementEndTime,
                    keyword,
                ),
            );
        }

        await Promise.all(storePromises);

        // remove asset from pending storage
        await this.pendingStorageService.removeCachedAssertion(
            pendingRepository,
            blockchain,
            contract,
            tokenId,
        );
    }

    async reinitializeContracts(blockchainId) {
        try {
            await this.blockchainModuleManager.initializeContracts(blockchainId);
        } catch (error) {
            this.logger.warn(`Unable to reinitialize contracts. Error: ${error.message}`);
            this.blockchainModuleManager.removeImplementation(blockchainId);
            if (!this.blockchainModuleManager.getImplementationNames().length) {
                this.logger.error(`Unable to initialize contracts. OT-node shutting down...`);
                process.exit(1);
            }
        }
    }
}

export default BlockchainEventListenerService;
