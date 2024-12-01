import Command from '../command.js';
import {
    BLOCKCHAIN_EVENT_PRIORITIES,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    CONTRACTS,
    CONTRACTS_EVENTS,
    CONTRACTS_EVENTS_LISTENED,
    DEFAULT_BLOCKCHAIN_EVENT_PRIORITY,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    SHARDING_TABLE_RELATED_EVENTS,
} from '../../constants/constants.js';

class BlockchainEventListenerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
        this.hashingService = ctx.hashingService;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainEventsService = ctx.blockchainEventsService;
        this.fileService = ctx.fileService;
        this.operationIdService = ctx.operationIdService;
        this.commandExecutor = ctx.commandExecutor;

        this.errorType = ERROR_TYPE.BLOCKCHAIN_EVENT_LISTENER_ERROR;
    }

    async execute(command) {
        const { blockchainId } = command.data;

        const repositoryTransaction = await this.repositoryModuleManager.transaction();

        try {
            await this.fetchAndHandleBlockchainEvents(blockchainId, repositoryTransaction);
            await repositoryTransaction.commit();
        } catch (e) {
            this.logger.error(
                `Failed to fetch and process blockchain events for blockchain: ${blockchainId}. Error: ${e}`,
            );
            await repositoryTransaction.rollback();

            return Command.repeat();
        }

        return Command.empty();
    }

    async fetchAndHandleBlockchainEvents(blockchainId, repositoryTransaction) {
        const currentBlock = (await this.blockchainEventsService.getBlock(blockchainId)).number;

        const contractEventsData = await Promise.all(
            Object.values(CONTRACTS_EVENTS).map(({ contract, events }) =>
                this.getContractEvents(blockchainId, contract, currentBlock, events),
            ),
        );

        if (contractEventsData.some(({ eventsMissed }) => eventsMissed)) {
            await this.shardingTableService.pullBlockchainShardingTable(blockchainId, true);
            this.filterShardingTableRelatedEvents(contractEventsData);
        }

        const unprocessedEvents =
            await this.repositoryModuleManager.getAllUnprocessedBlockchainEvents(
                CONTRACTS_EVENTS_LISTENED,
                blockchainId,
            );

        if (unprocessedEvents.length > 0) {
            this.logger.trace(`Found ${unprocessedEvents.length} unprocessed blockchain events.`);
        }

        const contractLastCheckedBlock = {};
        const events = unprocessedEvents;

        for (const {
            contractName,
            lastCheckedBlock,
            events: contractEvents,
        } of contractEventsData) {
            const prioritizedEvents = contractEvents.map((event) => ({
                ...event,
                priority:
                    BLOCKCHAIN_EVENT_PRIORITIES[event.event] || DEFAULT_BLOCKCHAIN_EVENT_PRIORITY,
            }));

            // Collect all prioritized events
            events.push(...prioritizedEvents);

            // Update the last checked block for this contract
            contractLastCheckedBlock[contractName] = lastCheckedBlock;
        }

        if (events.length !== 0) {
            this.logger.trace(
                `Storing ${events.length} events for blockchain ${blockchainId} in the database.`,
            );
            await this.repositoryModuleManager.insertBlockchainEvents(events, {
                transaction: repositoryTransaction,
            });
            await this.processEventsByPriority(events, repositoryTransaction);
        }

        await this.updateLastCheckedBlocks(
            blockchainId,
            contractLastCheckedBlock,
            repositoryTransaction,
        );
    }

    async getContractEvents(blockchain, contractName, currentBlock, eventsToFilter) {
        const lastCheckedBlockObject = await this.repositoryModuleManager.getLastCheckedBlock(
            blockchain,
            contractName,
        );

        const result = await this.blockchainEventsService.getPastEvents(
            blockchain,
            contractName,
            eventsToFilter,
            lastCheckedBlockObject?.lastCheckedBlock ?? 0,
            currentBlock,
        );

        return { ...result, contractName };
    }

    filterShardingTableRelatedEvents(contractEventsData) {
        contractEventsData.forEach((data) => {
            if (SHARDING_TABLE_RELATED_EVENTS[data.contractName]) {
                // eslint-disable-next-line no-param-reassign
                data.events = data.events.filter(
                    (event) =>
                        !SHARDING_TABLE_RELATED_EVENTS[data.contractName].includes(event.event),
                );
            }
        });
    }

    async processEventsByPriority(events, repositoryTransaction) {
        const eventsByPriority = {};
        for (const event of events) {
            if (!eventsByPriority[event.priority]) {
                eventsByPriority[event.priority] = [];
            }
            eventsByPriority[event.priority].push(event);
        }

        // Process each priority level sequentially
        const priorityLevels = Object.keys(eventsByPriority).sort((a, b) => a - b);
        for (const priority of priorityLevels) {
            const priorityLevelEvents = eventsByPriority[priority];

            // eslint-disable-next-line no-await-in-loop
            await Promise.all(
                priorityLevelEvents.map((event) => this.processEvent(event, repositoryTransaction)),
            );
            // eslint-disable-next-line no-await-in-loop
            await this.repositoryModuleManager.markBlockchainEventsAsProcessed(
                priorityLevelEvents,
                { transaction: repositoryTransaction },
            );
        }
    }

    async processEvent(event, repositoryTransaction) {
        const handlerFunctionName = `handle${event.event}Event`;

        if (typeof this[handlerFunctionName] !== 'function') {
            this.logger.warn(`No handler for event type: ${event.event}`);
            return;
        }

        this.logger.trace(`Processing event ${event.event} in block ${event.block}.`);
        try {
            await this[handlerFunctionName](event, repositoryTransaction);
        } catch (error) {
            this.logger.error(
                `Error processing event ${event.event} in block ${event.block}: ${error.message}`,
            );
        }
    }

    async updateLastCheckedBlocks(blockchainId, contractLastCheckedBlock, repositoryTransaction) {
        await Promise.all(
            Object.entries(contractLastCheckedBlock).map(([contractName, lastCheckedBlock]) =>
                this.repositoryModuleManager.updateLastCheckedBlock(
                    blockchainId,
                    lastCheckedBlock,
                    Date.now(),
                    contractName,
                    { transaction: repositoryTransaction },
                ),
            ),
        );
    }

    async handleParameterChangedEvent(event) {
        const { blockchainId, contract, data } = event;
        const { parameterName, parameterValue } = JSON.parse(data);
        switch (contract) {
            case CONTRACTS.PARAMETERS_STORAGE:
                this.blockchainModuleManager.setContractCallCache(
                    blockchainId,
                    CONTRACTS.PARAMETERS_STORAGE,
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

    handleNewContractEvent(event) {
        const { contractName, newContractAddress } = JSON.parse(event.data);
        this.blockchainModuleManager.initializeContract(
            event.blockchain,
            contractName,
            newContractAddress,
        );
    }

    async handleContractChangedEvent(event) {
        const { contractName, newContractAddress } = JSON.parse(event.data);
        this.blockchainModuleManager.initializeContract(
            event.blockchain,
            contractName,
            newContractAddress,
        );

        if (contractName === CONTRACTS.SHARDING_TABLE) {
            await this.shardingTableService.pullBlockchainShardingTable(event.blockchain, true);
        }
    }

    handleNewAssetStorageEvent(event) {
        const { newContractAddress } = JSON.parse(event.data);
        this.blockchainModuleManager.initializeAssetStorageContract(
            event.blockchain,
            newContractAddress,
        );
    }

    handleAssetStorageChangedEvent(event) {
        const { newContractAddress } = JSON.parse(event.data);
        this.blockchainModuleManager.initializeAssetStorageContract(
            event.blockchain,
            newContractAddress,
        );
    }

    async handleNodeAddedEvent(event, repositoryTransaction) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain,
            eventData.nodeId,
        );

        const sha256 = await this.hashingService.callHashFunction(
            CONTENT_ASSET_HASH_FUNCTION_ID,
            nodeId,
        );

        await this.repositoryModuleManager.createPeerRecord(
            nodeId,
            event.blockchain,
            this.blockchainModuleManager.convertFromWei(event.blockchain, eventData.ask),
            this.blockchainModuleManager.convertFromWei(event.blockchain, eventData.stake),
            new Date(0),
            sha256,
            { transaction: repositoryTransaction },
        );
    }

    async handleNodeRemovedEvent(event, repositoryTransaction) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain,
            eventData.nodeId,
        );

        this.logger.trace(`Removing peer id: ${nodeId} from sharding table.`);

        await this.repositoryModuleManager.removePeerRecord(event.blockchain, nodeId, {
            transaction: repositoryTransaction,
        });
    }

    async handleStakeIncreasedEvent(event, repositoryTransaction) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain,
            eventData.nodeId,
        );

        await this.repositoryModuleManager.updatePeerStake(
            nodeId,
            event.blockchain,
            this.blockchainModuleManager.convertFromWei(event.blockchain, eventData.newStake),
            { transaction: repositoryTransaction },
        );
    }

    async handleStakeWithdrawalStartedEvent(event) {
        await this.handleStakeIncreasedEvent(event);
    }

    async handleAskUpdatedEvent(event, repositoryTransaction) {
        const eventData = JSON.parse(event.data);

        const nodeId = this.blockchainModuleManager.convertHexToAscii(
            event.blockchain,
            eventData.nodeId,
        );

        await this.repositoryModuleManager.updatePeerAsk(
            nodeId,
            event.blockchain,
            this.blockchainModuleManager.convertFromWei(event.blockchain, eventData.ask),
            { transaction: repositoryTransaction },
        );
    }

    async handleAssetMintedEvent(event) {
        const eventData = JSON.parse(event.data);

        const { assetContract, tokenId, state, publishOperationId } = eventData;
        const { blockchain } = event;

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_START,
        );

        const datasetPath = this.fileService.getPendingStorageDocumentPath(publishOperationId);

        const data = await this.fileService.readFile(datasetPath, true);

        const ual = this.ualService.deriveUAL(blockchain, assetContract, tokenId);

        await this.commandExecutor.add({
            name: 'validateAssertionMetadataCommand',
            sequence: ['storeAssertionCommand'],
            delay: 0,
            data: {
                operationId,
                ual,
                blockchain,
                contract: assetContract,
                tokenId,
                merkleRoot: state,
                assertion: data.assertion,
                cachedMerkleRoot: data.merkleRoot,
            },
            transactional: false,
        });
    }

    /**
     * Recover system from failure
     * @param error
     */
    async recover() {
        return Command.repeat();
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
