import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    CONTRACTS,
    CONTRACT_EVENTS,
    TRIPLE_STORE_REPOSITORIES,
} from '../constants/constants.js';

class EventListenerService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.dataService = ctx.dataService;
        this.eventEmitter = ctx.eventEmitter;
    }

    initialize() {
        for (const blockchainId of this.blockchainModuleManager.getImplementationNames()) {
            this.listenOnEvents(blockchainId);
            this.logger.info(`Event listener initialized for blockchain: '${blockchainId}'.`);
        }
    }

    listenOnEvents(blockchainId) {
        this.listenOnHubEvents(blockchainId);
        this.listenOnShardingTableEvents(blockchainId);
        this.listenOnStakingEvents(blockchainId);
        this.listenOnProfileEvents(blockchainId);
        this.listenOnCommitManagerEvents(blockchainId);
    }

    listenOnHubEvents(blockchainId) {
        const newContractEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.HUB.NEW_CONTRACT,
        );
        this.eventEmitter.on(newContractEvent, async () => {
            this.reinitializeContracts(blockchainId);
        });

        const contractChangedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.HUB.CONTRACT_CHANGED,
        );
        this.eventEmitter.on(contractChangedEvent, async (event) => {
            await this.reinitializeContracts(blockchainId);
            if (event.contractName === CONTRACTS.SHARDING_TABLE_CONTRACT) {
                await this.repositoryModuleManager.cleanShardingTable();
            }
        });

        const newAssetStorageEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.HUB.NEW_ASSET_STORAGE,
        );
        this.eventEmitter.on(newAssetStorageEvent, async () => {
            await this.reinitializeContracts(blockchainId);
        });

        const assetStorageChangedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.HUB.ASSET_STORAGE_CHANGED,
        );
        this.eventEmitter.on(assetStorageChangedEvent, async () => {
            await this.reinitializeContracts(blockchainId);
        });
    }

    // TODO: review this
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

    listenOnShardingTableEvents(blockchainId) {
        const nodeAddedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.SHARDING_TABLE.NODE_ADDED,
        );
        this.eventEmitter.on(nodeAddedEvent, async (event) => {
            this.logger.trace(`${nodeAddedEvent} event caught.`);
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
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.ask),
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.stake),
                new Date(0),
                nodeIdSha256,
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        const nodeRemovedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.SHARDING_TABLE.NODE_REMOVED,
        );
        this.eventEmitter.on(nodeRemovedEvent, async (event) => {
            this.logger.trace(`${nodeRemovedEvent} event caught.`);
            const eventData = JSON.parse(event.data);

            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );

            this.logger.trace(`Removing peer id: ${nodeId} from sharding table.`);

            await this.repositoryModuleManager.removePeerRecord(blockchainId, nodeId);

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
    }

    listenOnStakingEvents(blockchainId) {
        const stakeIncreasedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.STAKING.STAKE_INCREASED,
        );
        this.eventEmitter.on(stakeIncreasedEvent, async (event) => {
            this.logger.trace(`${stakeIncreasedEvent} event caught.`);
            const eventData = JSON.parse(event.data);

            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );

            this.logger.trace(`Updating stake value for peer id: ${nodeId} in sharding table.`);

            await this.repositoryModuleManager.updatePeerStake(
                blockchainId,
                nodeId,
                this.blockchainModuleManager.convertFromWei(
                    blockchainId,
                    await this.blockchainModuleManager.getNodeStake(
                        blockchainId,
                        eventData.identityId,
                    ),
                ),
            );
            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        const stakeWithdrawalStartedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.STAKING.STAKE_WITHDRAWAL_STARTED,
        );
        this.eventEmitter.on(stakeWithdrawalStartedEvent, async (event) => {
            this.logger.trace(`${stakeWithdrawalStartedEvent} event caught.`);
            const eventData = JSON.parse(event.data);

            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );

            this.logger.trace(`Updating stake value for peer id: ${nodeId} in sharding table.`);

            await this.repositoryModuleManager.updatePeerStake(
                blockchainId,
                nodeId,
                this.blockchainModuleManager.convertFromWei(
                    blockchainId,
                    await this.blockchainModuleManager.getNodeStake(
                        blockchainId,
                        eventData.identityId,
                    ),
                ),
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
    }

    listenOnProfileEvents(blockchainId) {
        const askUpdatedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.PROFILE.ASK_UPDATED,
        );
        this.eventEmitter.on(askUpdatedEvent, async (event) => {
            this.logger.trace(`${askUpdatedEvent} event caught.`);
            const eventData = JSON.parse(event.data);

            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );

            this.logger.trace(`Updating ask value for peer id: ${nodeId} in sharding table.`);

            await this.repositoryModuleManager.updatePeerAsk(
                blockchainId,
                nodeId,
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.ask),
            );
            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
    }

    listenOnCommitManagerEvents(blockchainId) {
        const stateFinalizedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.COMMIT_MANAGER_V1.STATE_FINALIZED,
        );
        this.eventEmitter.on(stateFinalizedEvent, async (event) => {
            this.logger.trace(`${stateFinalizedEvent} event caught.`);
            const eventData = JSON.parse(event.data);

            const { tokenId, keyword } = eventData;
            const blockchain = event.blockchain_id;
            const contract = eventData.assetContract;
            const assertionId = eventData.state;

            const assetMetadata = await this.tripleStoreService.getAssetMetadata(
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                blockchain,
                contract,
                tokenId,
            );

            // if asset exists in triple store
            if (assetMetadata) {
                const previousAssertionId = assetMetadata.assertion.replace('assertion:', '');
                const previousAssertion = await this.tripleStoreService.localGet(
                    previousAssertionId,
                );

                // copy metadata and assertion from public current to historical state
                await this.tripleStoreService.localStoreAsset(
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                    previousAssertionId,
                    previousAssertion,
                    blockchain,
                    contract,
                    tokenId,
                    assetMetadata.agreementStartTime,
                    assetMetadata.agreementEndTime,
                    keyword,
                );

                // delete asset metadata from public current
                await this.tripleStoreService.deleteAssetMetadata(
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    blockchain,
                    contract,
                    tokenId,
                );

                const assetsWithAssertionIdCount =
                    await this.tripleStoreService.countAssetsWithAssertionId(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                        previousAssertionId,
                    );

                // delete assertion from public current if not linked to other assets
                if (assetsWithAssertionIdCount === 0) {
                    await this.tripleStoreService.deleteAssertion(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                        previousAssertionId,
                    );
                }
            }

            /* 
            // if ual file exists in pending storage
                // insert assertion in public current triple store
                // insert asset metadata in public current triple store
                // delete ual file from pending storage */
        });
    }

    getBlockchainEventName(blockchainId, eventName) {
        return `${blockchainId}-${eventName}`;
    }
}

export default EventListenerService;
