import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    CONTRACTS,
    CONTRACT_EVENT_FETCH_INTERVALS,
    TRIPLE_STORE_REPOSITORIES,
    NODE_ENVIRONMENTS,
    PENDING_STORAGE_REPOSITORIES,
    CONTRACT_EVENTS,
} from '../constants/constants.js';

const MAXIMUM_FETCH_EVENTS_FAILED_COUNT = 5;
const fetchEventsFailedCount = {};

const eventNames = Object.values(CONTRACT_EVENTS).flatMap((e) => e);

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

    async initialize() {
        const promises = [];
        for (const blockchainId of this.blockchainModuleManager.getImplementationNames()) {
            this.logger.info(
                `Initializing blockchain event listener for blockchain ${blockchainId}, handling missed events`,
            );
            promises.push(this.fetchAndHandleBlockchainEvents(blockchainId));
        }
        await Promise.all(promises);
    }

    startListeningOnEvents() {
        for (const blockchainId of this.blockchainModuleManager.getImplementationNames()) {
            this.listenOnBlockchainEvents(blockchainId);
            this.logger.info(`Event listener initialized for blockchain: '${blockchainId}'.`);
        }
    }

    async fetchAndHandleBlockchainEvents(blockchainId) {
        const devEnvironment =
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

        const currentBlock = await this.blockchainModuleManager.getBlockNumber(blockchainId);
        const syncContractEventsPromises = [
            this.getContractEvents(
                blockchainId,
                CONTRACTS.SHARDING_TABLE_CONTRACT,
                currentBlock,
                CONTRACT_EVENTS.SHARDING_TABLE,
            ),
            this.getContractEvents(
                blockchainId,
                CONTRACTS.STAKING_CONTRACT,
                currentBlock,
                CONTRACT_EVENTS.STAKING,
            ),
            this.getContractEvents(
                blockchainId,
                CONTRACTS.PROFILE_CONTRACT,
                currentBlock,
                CONTRACT_EVENTS.PROFILE,
            ),
            this.getContractEvents(
                blockchainId,
                CONTRACTS.COMMIT_MANAGER_V1_U1_CONTRACT,
                currentBlock,
                CONTRACT_EVENTS.COMMIT_MANAGER_V1,
            ),
            this.getContractEvents(
                blockchainId,
                CONTRACTS.SERVICE_AGREEMENT_V1_CONTRACT,
                currentBlock,
                CONTRACT_EVENTS.SERVICE_AGREEMENT_V1,
            ),
            this.getContractEvents(
                blockchainId,
                CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
                currentBlock,
                CONTRACT_EVENTS.PARAMETERS_STORAGE,
            ),
        ];

        if (!devEnvironment) {
            syncContractEventsPromises.push(
                this.getContractEvents(
                    blockchainId,
                    CONTRACTS.HUB_CONTRACT,
                    currentBlock,
                    CONTRACT_EVENTS.HUB,
                ),
            );
        }
        const contractEvents = await Promise.all(syncContractEventsPromises);

        await this.handleBlockchainEvents(
            contractEvents.flatMap((events) => events),
            blockchainId,
        );
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
                await this.fetchAndHandleBlockchainEvents(blockchainId);
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

    async getContractEvents(blockchainId, contractName, currentBlock, eventsToFilter) {
        const lastCheckedBlockObject = await this.repositoryModuleManager.getLastCheckedBlock(
            blockchainId,
            contractName,
        );

        const events = await this.blockchainModuleManager.getAllPastEvents(
            blockchainId,
            contractName,
            eventsToFilter,
            lastCheckedBlockObject?.lastCheckedBlock ?? 0,
            lastCheckedBlockObject?.lastCheckedTimestamp ?? 0,
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

    async handleBlockchainEvents(events, blockchainId) {
        const eventsForProcessing = events.filter((event) => eventNames.includes(event.event));

        if (eventsForProcessing?.length) {
            this.logger.trace(
                `${eventsForProcessing.length} blockchain events caught on blockchain ${blockchainId}.`,
            );
            await this.repositoryModuleManager.insertBlockchainEvents(eventsForProcessing);
        }
        const unprocessedEvents =
            await this.repositoryModuleManager.getAllUnprocessedBlockchainEvents(
                eventNames,
                blockchainId,
            );

        if (unprocessedEvents?.length) {
            this.logger.trace(
                `Processing ${unprocessedEvents.length} blockchain events on blockchain ${blockchainId}.`,
            );
            let groupedEvents = {};
            let currentBlock = 0;
            for (const event of unprocessedEvents) {
                if (event.block !== currentBlock) {
                    // eslint-disable-next-line no-await-in-loop
                    await this.handleBlockGroupedEvents(groupedEvents);
                    groupedEvents = {};
                    currentBlock = event.block;
                }
                if (groupedEvents[event.event]) {
                    groupedEvents[event.event].push(event);
                } else {
                    groupedEvents[event.event] = [event];
                }
            }

            await this.handleBlockGroupedEvents(groupedEvents);
        }
    }

    async handleBlockGroupedEvents(groupedEvents) {
        const handleBlockEventsPromises = [];
        for (const [eventName, blockEvents] of Object.entries(groupedEvents)) {
            handleBlockEventsPromises.push(this.handleBlockEvents(eventName, blockEvents));
        }
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(handleBlockEventsPromises);
    }

    async handleBlockEvents(eventName, blockEvents) {
        const handlerFunctionName = `handle${eventName}Events`;
        if (!this[handlerFunctionName]) return;
        this.logger.trace(`${blockEvents.length} ${eventName} events caught.`);
        try {
            await this[handlerFunctionName](blockEvents);
            await this.repositoryModuleManager.markBlockchainEventsAsProcessed(blockEvents);
        } catch (error) {
            this.logger.warn(
                `Error while processing events: ${eventName}. Error: ${error.message}`,
            );
        }
    }

    async handleParameterChangedEvents(blockEvents) {
        for (const event of blockEvents) {
            const { parameterName, parameterValue } = JSON.parse(event.data);
            this.blockchainModuleManager.setContractCallCache(
                event.blockchainId,
                CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
                parameterName,
                parameterValue,
            );
        }
    }

    handleNewContractEvents(blockEvents) {
        for (const event of blockEvents) {
            const { contractName, newContractAddress } = JSON.parse(event.data);
            this.blockchainModuleManager.initializeContract(
                event.blockchainId,
                contractName,
                newContractAddress,
            );
        }
    }

    async handleContractChangedEvents(blockEvents) {
        await Promise.all(
            blockEvents.map(async (event) => {
                const { contractName, newContractAddress } = JSON.parse(event.data);
                this.blockchainModuleManager.initializeContract(
                    event.blockchainId,
                    contractName,
                    newContractAddress,
                );

                if (contractName === CONTRACTS.SHARDING_TABLE_CONTRACT) {
                    await this.repositoryModuleManager.cleanShardingTable(event.blockchainId);
                }
            }),
        );
    }

    handleNewAssetStorageEvents(blockEvents) {
        for (const event of blockEvents) {
            const { newContractAddress } = JSON.parse(event.data);
            this.blockchainModuleManager.initializeAssetStorageContract(
                event.blockchainId,
                newContractAddress,
            );
        }
    }

    handleAssetStorageChangedEvents(blockEvents) {
        for (const event of blockEvents) {
            const { newContractAddress } = JSON.parse(event.data);
            this.blockchainModuleManager.initializeAssetStorageContract(
                event.blockchainId,
                newContractAddress,
            );
        }
    }

    async handleNodeAddedEvents(blockEvents) {
        const peerRecords = await Promise.all(
            blockEvents.map(async (event) => {
                const eventData = JSON.parse(event.data);

                const nodeId = this.blockchainModuleManager.convertHexToAscii(
                    event.blockchainId,
                    eventData.nodeId,
                );

                const nodeIdSha256 = await this.validationModuleManager.callHashFunction(
                    // TODO: How to add more hashes?
                    CONTENT_ASSET_HASH_FUNCTION_ID,
                    nodeId,
                );

                this.logger.trace(`Adding peer id: ${nodeId} to sharding table.`);
                return {
                    peerId: nodeId,
                    blockchainId: event.blockchainId,
                    ask: this.blockchainModuleManager.convertFromWei(
                        event.blockchainId,
                        eventData.ask,
                    ),
                    stake: this.blockchainModuleManager.convertFromWei(
                        event.blockchainId,
                        eventData.stake,
                    ),
                    lastSeen: new Date(0),
                    sha256: nodeIdSha256,
                };
            }),
        );
        await this.repositoryModuleManager.createManyPeerRecords(peerRecords);
    }

    async handleNodeRemovedEvents(blockEvents) {
        await Promise.all(
            blockEvents.map(async (event) => {
                const eventData = JSON.parse(event.data);

                const nodeId = this.blockchainModuleManager.convertHexToAscii(
                    event.blockchainId,
                    eventData.nodeId,
                );

                this.logger.trace(`Removing peer id: ${nodeId} from sharding table.`);

                await this.repositoryModuleManager.removePeerRecord(event.blockchainId, nodeId);
            }),
        );
    }

    async handleStakeIncreasedEvents(blockEvents) {
        await Promise.all(
            blockEvents.map(async (event) => {
                const eventData = JSON.parse(event.data);

                const nodeId = this.blockchainModuleManager.convertHexToAscii(
                    event.blockchainId,
                    eventData.nodeId,
                );

                this.logger.trace(`Updating stake value for peer id: ${nodeId} in sharding table.`);

                await this.repositoryModuleManager.updatePeerStake(
                    nodeId,
                    event.blockchainId,
                    this.blockchainModuleManager.convertFromWei(
                        event.blockchainId,
                        eventData.newStake,
                    ),
                );
            }),
        );
    }

    async handleStakeWithdrawalStartedEvents(blockEvents) {
        await this.handleStakeIncreasedEvents(blockEvents);
    }

    async handleAskUpdatedEvents(blockEvents) {
        await Promise.all(
            blockEvents.map(async (event) => {
                const eventData = JSON.parse(event.data);

                const nodeId = this.blockchainModuleManager.convertHexToAscii(
                    event.blockchainId,
                    eventData.nodeId,
                );

                this.logger.trace(`Updating ask value for peer id: ${nodeId} in sharding table.`);

                await this.repositoryModuleManager.updatePeerAsk(
                    nodeId,
                    event.blockchainId,
                    this.blockchainModuleManager.convertFromWei(event.blockchainId, eventData.ask),
                );
            }),
        );
    }

    async handleServiceAgreementV1ExtendedEvents(blockEvents) {
        await Promise.all(
            blockEvents.map(async (event) => {
                const { agreementId } = JSON.parse(event.data);

                const { epochsNumber } = await this.blockchainModuleManager.getAgreementData(
                    event.blockchainId,
                    agreementId,
                );

                return this.repositoryModuleManager.updateServiceAgreementEpochsNumber(
                    agreementId,
                    epochsNumber,
                );
            }),
        );
    }

    async handleServiceAgreementV1TerminatedEvents(blockEvents) {
        await this.repositoryModuleManager.removeServiceAgreements(
            blockEvents.map((event) => JSON.parse(event.data).agreementId),
        );
    }

    async handleStateFinalizedEvents(blockEvents) {
        // todo: find a way to safely parallelize this
        for (const event of blockEvents) {
            const eventData = JSON.parse(event.data);

            const { tokenId, keyword, state, stateIndex } = eventData;
            const blockchain = event.blockchainId;
            const contract = eventData.assetContract;
            this.logger.trace(
                `Handling event: ${event.event} for asset with ual: ${this.ualService.deriveUAL(
                    blockchain,
                    contract,
                    tokenId,
                )} with keyword: ${keyword}, assertion id: ${state}.`,
            );

            // eslint-disable-next-line no-await-in-loop
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
                    stateIndex,
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
                    stateIndex,
                ),
            ]);
        }
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
        stateIndex,
    ) {
        const assertionLinks = await this.tripleStoreService.getAssetAssertionLinks(
            currentRepository,
            blockchain,
            contract,
            tokenId,
        );
        const storedAssertionIds = assertionLinks.map(({ assertion }) =>
            assertion.replace('assertion:', ''),
        );

        // event already handled
        if (storedAssertionIds.includes(assertionId)) {
            return;
        }

        // move old assertions to history repository
        await Promise.all(
            storedAssertionIds.map((storedAssertionId) =>
                this.tripleStoreService.moveAsset(
                    currentRepository,
                    historyRepository,
                    storedAssertionId,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                ),
            ),
        );

        await this.tripleStoreService.deleteAssetMetadata(
            currentRepository,
            blockchain,
            contract,
            tokenId,
        );

        const cachedData = await this.pendingStorageService.getCachedAssertion(
            pendingRepository,
            blockchain,
            contract,
            tokenId,
            assertionId,
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
                    keyword,
                ),
            );

            if (
                currentRepository === TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT &&
                cachedData.agreementId &&
                cachedData.agreementData
            ) {
                const serviceAgreement =
                    await this.repositoryModuleManager.getServiceAgreementRecord(
                        cachedData.agreementId,
                    );

                await this.repositoryModuleManager.updateServiceAgreementRecord(
                    blockchain,
                    contract,
                    tokenId,
                    cachedData.agreementId,
                    cachedData.agreementData.startTime,
                    cachedData.agreementData.epochsNumber,
                    cachedData.agreementData.epochLength,
                    cachedData.agreementData.scoreFunctionId,
                    cachedData.agreementData.proofWindowOffsetPerc,
                    CONTENT_ASSET_HASH_FUNCTION_ID,
                    keyword,
                    assertionId,
                    stateIndex,
                    serviceAgreement?.lastCommitEpoch,
                    serviceAgreement?.lastProofEpoch,
                );
            }
        } else if (currentRepository === TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT) {
            await this.repositoryModuleManager.removeServiceAgreementRecord(
                blockchain,
                contract,
                tokenId,
            );
        }

        if (cachedData?.private?.assertion && cachedData?.private?.assertionId) {
            // insert private assertion in current repository
            storePromises.push(
                this.tripleStoreService.localStoreAsset(
                    currentRepository,
                    cachedData.private.assertionId,
                    cachedData.private.assertion,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                ),
            );
        }

        await Promise.all(storePromises);

        // remove asset from pending storage
        if (cachedData) {
            await this.pendingStorageService.removeCachedAssertion(
                pendingRepository,
                blockchain,
                contract,
                tokenId,
                assertionId,
            );
        }
    }
}

export default BlockchainEventListenerService;
