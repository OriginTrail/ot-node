import Command from '../command.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    CONTRACTS,
    CONTRACT_EVENT_FETCH_INTERVALS,
    TRIPLE_STORE_REPOSITORIES,
    NODE_ENVIRONMENTS,
    PENDING_STORAGE_REPOSITORIES,
    CONTRACT_EVENTS,
    MAXIMUM_FETCH_EVENTS_FAILED_COUNT,
    DELAY_BETWEEN_FAILED_FETCH_EVENTS_MILLIS,
    CONTRACT_EVENT_TO_GROUP_MAPPING,
    GROUPED_CONTRACT_EVENTS,
    ZERO_BYTES32,
} from '../../constants/constants.js';

const fetchEventsFailedCount = {};
const eventNames = Object.values(CONTRACT_EVENTS).flat();

class BlockchainEventListenerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.ualService = ctx.ualService;
        this.hashingService = ctx.hashingService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.shardingTableService = ctx.shardingTableService;
        this.paranetService = ctx.paranetService;
        this.eventListenerModuleManager = ctx.eventListenerModuleManager;

        this.eventListenerImplementation = this.eventListenerModuleManager.getImplementation();
        this.eventGroupsBuffer = {};
    }

    async execute() {
        for (const blockchainId of this.blockchainModuleManager.getImplementationNames()) {
            this.eventGroupsBuffer[blockchainId] = {};

            const blockchainConfig =
                this.blockchainModuleManager.getModuleConfiguration(blockchainId);
            this.eventListenerModuleManager.initializeBlockchainEventListener(
                this.eventListenerImplementation,
                blockchainConfig,
            );

            this.isDevEnvironment = [
                NODE_ENVIRONMENTS.DEVELOPMENT,
                NODE_ENVIRONMENTS.TEST,
            ].includes(process.env.NODE_ENV);

            const eventFetchInterval = this.isDevEnvironment
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
                    fetchEventsFailedCount[blockchainId] += 1;
                    const failCount = fetchEventsFailedCount[blockchainId];

                    if (failCount >= MAXIMUM_FETCH_EVENTS_FAILED_COUNT) {
                        clearInterval(fetchEventInterval);
                        this.blockchainModuleManager.removeImplementation(blockchainId);

                        const errorMessage = `Unable to fetch new events for blockchain: ${blockchainId}. Error message: ${e.message}`;

                        if (!this.blockchainModuleManager.getImplementationNames().length) {
                            this.logger.error(`${errorMessage} OT-node shutting down...`);
                            process.exit(1);
                        }

                        this.logger.error(`${errorMessage} blockchain implementation removed.`);
                    }

                    this.logger.error(
                        `Failed to get and process blockchain events for blockchain: ${blockchainId}. Error: ${e}`,
                    );
                    setTimeout(DELAY_BETWEEN_FAILED_FETCH_EVENTS_MILLIS);
                } finally {
                    working = false;
                }
            }, eventFetchInterval);
        }

        return Command.empty();
    }

    async fetchAndHandleBlockchainEvents(blockchainId) {
        const currentBlock = await this.blockchainModuleManager.getBlockNumber(blockchainId);

        const contractsEventsConfig = [
            { contract: CONTRACTS.SHARDING_TABLE_CONTRACT, events: CONTRACT_EVENTS.SHARDING_TABLE },
            { contract: CONTRACTS.STAKING_CONTRACT, events: CONTRACT_EVENTS.STAKING },
            { contract: CONTRACTS.PROFILE_CONTRACT, events: CONTRACT_EVENTS.PROFILE },
            {
                contract: CONTRACTS.COMMIT_MANAGER_V1_U1_CONTRACT,
                events: CONTRACT_EVENTS.COMMIT_MANAGER_V1,
            },
            {
                contract: CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
                events: CONTRACT_EVENTS.PARAMETERS_STORAGE,
            },
            { contract: CONTRACTS.LOG2PLDSF_CONTRACT, events: CONTRACT_EVENTS.LOG2PLDSF },
            { contract: CONTRACTS.LINEAR_SUM_CONTRACT, events: CONTRACT_EVENTS.LINEAR_SUM },
        ];

        if (this.isDevEnvironment) {
            // handling sharding table node added events first for tests and local network setup
            // because of race condition for node added and ask updated events
            const shardingTableEvents = await this.getContractEvents(
                blockchainId,
                CONTRACTS.SHARDING_TABLE_CONTRACT,
                currentBlock,
                CONTRACT_EVENTS.SHARDING_TABLE,
            );

            await this.handleBlockchainEvents(shardingTableEvents, blockchainId);
        } else {
            contractsEventsConfig.push({
                contract: CONTRACTS.HUB_CONTRACT,
                events: CONTRACT_EVENTS.HUB,
            });
        }

        const contractEvents = await Promise.all(
            contractsEventsConfig.map(({ contract, events }) =>
                this.getContractEvents(blockchainId, contract, currentBlock, events),
            ),
        );

        await this.handleBlockchainEvents(contractEvents.flat(), blockchainId);
    }

    async getContractEvents(blockchainId, contractName, currentBlock, eventsToFilter) {
        const lastCheckedBlockObject = await this.repositoryModuleManager.getLastCheckedBlock(
            blockchainId,
            contractName,
        );

        const contract = this.blockchainModuleManager.getContract(blockchainId, contractName);

        const result = await this.eventListenerModuleManager.getAllPastEvents(
            this.eventListenerImplementation,
            blockchainId,
            contractName,
            contract,
            eventsToFilter,
            lastCheckedBlockObject?.lastCheckedBlock ?? 0,
            lastCheckedBlockObject?.lastCheckedTimestamp ?? 0,
            currentBlock,
        );

        await this.repositoryModuleManager.updateLastCheckedBlock(
            blockchainId,
            result.lastCheckedBlock,
            Date.now(0),
            contractName,
        );

        if (!result.eventsMissed) {
            await this.shardingTableService.pullBlockchainShardingTable(blockchainId, true);
        }

        return result.events;
    }

    async handleBlockchainEvents(events, blockchainId) {
        const eventsForProcessing = events.filter((event) => eventNames.includes(event.event));

        // Store new events in the DB
        if (eventsForProcessing?.length) {
            this.logger.trace(
                `${eventsForProcessing.length} blockchain events caught on blockchain ${blockchainId}.`,
            );
            await this.repositoryModuleManager.insertBlockchainEvents(eventsForProcessing);
        }

        // Get unprocessed events from the DB
        const unprocessedEvents =
            await this.repositoryModuleManager.getAllUnprocessedBlockchainEvents(
                eventNames,
                blockchainId,
            );

        // Process events block by block
        if (unprocessedEvents?.length) {
            this.logger.trace(
                `Processing ${unprocessedEvents.length} blockchain events on blockchain ${blockchainId}.`,
            );

            // Group events by block
            const eventsByBlock = this.groupEventsByBlock(unprocessedEvents);

            // Process each block
            const batchedEvents = {};
            for (const [, blockEvents] of Object.entries(eventsByBlock)) {
                // separate events into grouped and regular
                const { groupedEvents, regularEvents } = this.separateEvents(blockEvents);

                // Handle grouped events
                for (const event of groupedEvents) {
                    const eventsGroupName = CONTRACT_EVENT_TO_GROUP_MAPPING[event.event];
                    const eventsGroup = GROUPED_CONTRACT_EVENTS[eventsGroupName];
                    const groupingKeyValue = JSON.parse(event.data)[eventsGroup.groupingKey];

                    if (!this.eventGroupsBuffer[blockchainId][eventsGroupName]) {
                        this.eventGroupsBuffer[blockchainId][eventsGroupName] = {};
                    }

                    if (!this.eventGroupsBuffer[blockchainId][eventsGroupName][groupingKeyValue]) {
                        this.eventGroupsBuffer[blockchainId][eventsGroupName][groupingKeyValue] =
                            [];
                    }

                    // Add event to buffer
                    this.eventGroupsBuffer[blockchainId][eventsGroupName][groupingKeyValue].push(
                        event,
                    );

                    // Mark event as processed
                    // TODO: There should be a smarter way to do this, because it will cause troubles
                    // in case node goes offline while only catched some of the events from the group
                    // and not all of them. Buffer will be cleared and event is already marked as processed.
                    // eslint-disable-next-line no-await-in-loop
                    await this.repositoryModuleManager.markBlockchainEventsAsProcessed([event]);

                    // Check if group is complete
                    const currentGroup =
                        this.eventGroupsBuffer[blockchainId][eventsGroupName][groupingKeyValue];
                    if (currentGroup.length === eventsGroup.events.length) {
                        if (!batchedEvents[eventsGroupName]) {
                            batchedEvents[eventsGroupName] = [];
                        }

                        batchedEvents[eventsGroupName].push(
                            this.eventGroupsBuffer[blockchainId][eventsGroupName][groupingKeyValue],
                        );

                        delete this.eventGroupsBuffer[blockchainId][eventsGroupName][
                            groupingKeyValue
                        ];
                    }
                }

                // Handle regular events
                for (const event of regularEvents) {
                    batchedEvents[event.event] = batchedEvents[event.event] || [];
                    batchedEvents[event.event].push(event);
                }
            }

            await this.handleBlockBatchedEvents(batchedEvents);
        }
    }

    groupEventsByBlock(events) {
        const groupedEvents = {};
        for (const event of events) {
            groupedEvents[event.block] = groupedEvents[event.block] || [];
            groupedEvents[event.block].push(event);
        }
        return groupedEvents;
    }

    separateEvents(events) {
        const result = { groupedEvents: [], regularEvents: [] };
        for (const event of events) {
            const eventsGroupName = CONTRACT_EVENT_TO_GROUP_MAPPING[event.event];
            if (eventsGroupName) {
                result.groupedEvents.push(event);
            } else {
                result.regularEvents.push(event);
            }
        }
        return result;
    }

    async handleBlockBatchedEvents(batchedEvents) {
        const handleBlockEventsPromises = [];
        for (const [eventName, blockEvents] of Object.entries(batchedEvents)) {
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
            const { blockchainId, contract, data } = event;
            const { parameterName, parameterValue } = JSON.parse(data);
            switch (contract) {
                case CONTRACTS.LOG2PLDSF_CONTRACT:
                    // This invalidates contracts parameter
                    // TODO: Create function for contract call cache invalidation
                    this.blockchainModuleManager.setContractCallCache(
                        blockchainId,
                        CONTRACTS.LOG2PLDSF_CONTRACT,
                        parameterName,
                        null,
                    );
                    break;
                case CONTRACTS.LINEAR_SUM_CONTRACT:
                    this.blockchainModuleManager.setContractCallCache(
                        blockchainId,
                        CONTRACTS.LINEAR_SUM_CONTRACT,
                        parameterName,
                        null,
                    );
                    break;
                case CONTRACTS.PARAMETERS_STORAGE_CONTRACT:
                    this.blockchainModuleManager.setContractCallCache(
                        blockchainId,
                        CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
                        parameterName,
                        parameterValue,
                    );
                    break;
                default:
                    this.logger.warn(
                        `Unable to handle parameter changed event. Unknown contract name ${event.contract}`,
                    );
            }
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
                    await this.shardingTableService.pullBlockchainShardingTable(
                        event.blockchainId,
                        true,
                    );
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

                const sha256 = await this.hashingService.callHashFunction(
                    CONTENT_ASSET_HASH_FUNCTION_ID,
                    nodeId,
                );

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
                    sha256,
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

                await this.repositoryModuleManager.updatePeerAsk(
                    nodeId,
                    event.blockchainId,
                    this.blockchainModuleManager.convertFromWei(event.blockchainId, eventData.ask),
                );
            }),
        );
    }

    async handleStateFinalizedEvents(blockEvents) {
        // todo: find a way to safely parallelize this
        for (const event of blockEvents) {
            const eventData = JSON.parse(event.data);

            const { tokenId, keyword, hashFunctionId, state, stateIndex } = eventData;
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
                this.pendingStorageService.moveAndDeletePendingState(
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                    PENDING_STORAGE_REPOSITORIES.PUBLIC,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                    hashFunctionId,
                    state,
                    stateIndex,
                ),
                this.pendingStorageService.moveAndDeletePendingState(
                    TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                    TRIPLE_STORE_REPOSITORIES.PRIVATE_HISTORY,
                    PENDING_STORAGE_REPOSITORIES.PRIVATE,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                    hashFunctionId,
                    state,
                    stateIndex,
                ),
            ]);

            // eslint-disable-next-line no-await-in-loop
            const paranetsBlockchains = await this.repositoryModuleManager.getParanetsBlockchains();

            if (paranetsBlockchains.includes(blockchain)) {
                // eslint-disable-next-line no-await-in-loop
                const knowledgeAssetId = await this.paranetService.constructKnowledgeAssetId(
                    blockchain,
                    contract,
                    tokenId,
                );

                // eslint-disable-next-line no-await-in-loop
                const paranetId = await this.blockchainModuleManager.getParanetId(
                    blockchain,
                    knowledgeAssetId,
                );
                if (paranetId && paranetId !== ZERO_BYTES32) {
                    // eslint-disable-next-line no-await-in-loop
                    const paranetExists = await this.repositoryModuleManager.paranetExists(
                        paranetId,
                        blockchain,
                    );
                    if (paranetExists) {
                        const {
                            paranetKAStorageContract: paranetKasContract,
                            tokenId: paranetTokenId,
                        } =
                            // eslint-disable-next-line no-await-in-loop
                            await this.blockchainModuleManager.getKnowledgeAssetLocatorFromParanetId(
                                blockchain,
                                paranetId,
                            );
                        const paranetUAL = this.ualService.deriveUAL(
                            blockchain,
                            paranetKasContract,
                            paranetTokenId,
                        );

                        // eslint-disable-next-line no-await-in-loop
                        const paranetAssetExists = await this.tripleStoreService.paranetAssetExists(
                            blockchain,
                            contract,
                            tokenId,
                            paranetKasContract,
                            paranetTokenId,
                        );

                        if (paranetAssetExists) {
                            const kaUAL = this.ualService.deriveUAL(blockchain, contract, tokenId);

                            // Create a record for missing Paranet KA
                            // Paranet sync command will get it from network
                            // eslint-disable-next-line no-await-in-loop
                            await this.repositoryModuleManager.createMissedParanetAssetRecord({
                                blockchainId: blockchain,
                                ual: kaUAL,
                                paranetUal: paranetUAL,
                                knowledgeAssetId,
                            });
                        }
                    }
                }
            }
        }
    }

    /**
     * Builds default BlockchainEventListenerCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'blockchainEventListenerCommand',
            data: {},
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default BlockchainEventListenerCommand;
