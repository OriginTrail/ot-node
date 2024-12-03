import Command from '../command.js';
import {
    CONTRACTS,
    MONITORED_CONTRACT_EVENTS,
    CONTRACT_INDEPENDENT_EVENTS,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    MONITORED_CONTRACTS,
    MONITORED_EVENTS,
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

        this.invalidatedContracts = new Set();

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
        const lastCheckedBlockRecords = await this.repositoryModuleManager.getLastCheckedBlock(
            blockchainId,
        );

        const groupedLastCheckedBlocks = {};
        MONITORED_CONTRACTS.forEach((contract) => {
            const record = lastCheckedBlockRecords.find((r) => r.contract === contract);
            const lastCheckedBlock = record ? record.lastCheckedBlock : 0;
            if (!groupedLastCheckedBlocks[lastCheckedBlock]) {
                groupedLastCheckedBlocks[lastCheckedBlock] = [];
            }
            groupedLastCheckedBlocks[lastCheckedBlock].push(contract);
        });

        const groupedEventsResults = await Promise.all(
            Object.entries(groupedLastCheckedBlocks).map(async ([lastCheckedBlock, contracts]) => {
                const eventsToFilter = contracts.flatMap(
                    (contract) => MONITORED_CONTRACT_EVENTS[contract] || [],
                );
                return this.blockchainEventsService.getPastEvents(
                    blockchainId,
                    contracts,
                    eventsToFilter,
                    lastCheckedBlock,
                    currentBlock,
                );
            }),
        );

        if (groupedEventsResults.some(({ eventsMissed }) => eventsMissed)) {
            // TODO: Add some logic for missed events in the future
        }

        const newEvents = groupedEventsResults.flatMap(({ events }) => events);
        const lastCheckedBlock = currentBlock;

        if (newEvents.length !== 0) {
            this.logger.trace(
                `Storing ${newEvents.length} new events for blockchain ${blockchainId} in the database.`,
            );
            await this.repositoryModuleManager.insertBlockchainEvents(newEvents, {
                transaction: repositoryTransaction,
            });
            await this.repositoryModuleManager.updateLastCheckedBlock(
                blockchainId,
                MONITORED_CONTRACTS,
                lastCheckedBlock,
                Date.now(),
                { transaction: repositoryTransaction },
            );
        }

        const unprocessedEvents =
            await this.repositoryModuleManager.getAllUnprocessedBlockchainEvents(
                blockchainId,
                MONITORED_EVENTS,
            );

        if (unprocessedEvents.length > 0) {
            this.logger.trace(
                `Handling ${unprocessedEvents.length} unprocessed blockchain events.`,
            );
        }

        const independentEvents = [];
        const dependentEvents = [];
        for (const event of unprocessedEvents) {
            if (this.isIndependentEvent(event.contract, event.event)) {
                independentEvents.push(event);
            } else {
                dependentEvents.push(event);
            }
        }

        dependentEvents.sort((a, b) => {
            if (a.blockNumber !== b.blockNumber) {
                return a.blockNumber - b.blockNumber;
            }
            if (a.transactionIndex !== b.transactionIndex) {
                return a.transactionIndex - b.transactionIndex;
            }
            return a.logIndex - b.logIndex;
        });

        await Promise.all([
            this.processIndependentEvents(independentEvents, repositoryTransaction),
            this.processDependentEvents(dependentEvents, repositoryTransaction),
        ]);

        await this.repositoryModuleManager.markBlockchainEventsAsProcessed(unprocessedEvents, {
            transaction: repositoryTransaction,
        });
    }

    isIndependentEvent(contractName, eventName) {
        const contractIndependentEvents = CONTRACT_INDEPENDENT_EVENTS[contractName] || [];
        return contractIndependentEvents.includes(eventName);
    }

    async processIndependentEvents(independentEvents, repositoryTransaction) {
        await Promise.all(
            independentEvents.map((event) => this.processEvent(event, repositoryTransaction)),
        );
    }

    async processDependentEvents(dependentEvents, repositoryTransaction) {
        for (const event of dependentEvents) {
            if (this.invalidatedContracts.has(event.contract)) {
                this.logger.info(
                    `Skipping event ${event.event} for blockchain: ${event.blockchain}, invalidated contract: ${event.contract}`,
                );
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            await this.processEvent(event, repositoryTransaction);
        }

        this.invalidatedContracts.clear();
    }

    async processEvent(event, repositoryTransaction) {
        const handlerFunctionName = `handle${event.event}Event`;

        if (typeof this[handlerFunctionName] !== 'function') {
            this.logger.warn(`No handler for event type: ${event.event}`);
            return;
        }

        this.logger.trace(`Processing event ${event.event} in block ${event.blockNumber}.`);
        try {
            await this[handlerFunctionName](event, repositoryTransaction);
        } catch (error) {
            this.logger.error(
                `Error processing event ${event.event} in block ${event.blockNumber}: ${error.message}`,
            );
        }
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

    async handleNewContractEvent(event, repositoryTransaction) {
        const { contractName, newContractAddress } = JSON.parse(event.data);

        const blockchchainModuleContractAddress = this.blockchainModuleManager.getContractAddress(
            event.blockchain,
            contractName,
        );

        if (newContractAddress !== blockchchainModuleContractAddress) {
            this.blockchainModuleManager.initializeContract(
                event.blockchain,
                contractName,
                newContractAddress,
            );
        }

        const blockchainEventsServiceContractAddress =
            this.blockchainEventsService.getContractAddress(event.blockchain, contractName);

        if (newContractAddress !== blockchainEventsServiceContractAddress) {
            this.blockchainEventsService.updateContractAddress(
                event.blockchain,
                contractName,
                newContractAddress,
            );

            this.invalidatedContracts.add(contractName);

            await this.repositoryModuleManager.updateLastCheckedBlock(
                event.blockchain,
                [contractName],
                event.blockNumber,
                Date.now(),
                { transaction: repositoryTransaction },
            );
        }
    }

    async handleContractChangedEvent(event, repositoryTransaction) {
        const { contractName, newContractAddress } = JSON.parse(event.data);

        const blockchchainModuleContractAddress = this.blockchainModuleManager.getContractAddress(
            event.blockchain,
            contractName,
        );

        if (newContractAddress !== blockchchainModuleContractAddress) {
            this.blockchainModuleManager.initializeContract(
                event.blockchain,
                contractName,
                newContractAddress,
            );
        }

        const blockchainEventsServiceContractAddress =
            this.blockchainEventsService.getContractAddress(event.blockchain, contractName);

        if (newContractAddress !== blockchainEventsServiceContractAddress) {
            this.blockchainEventsService.updateContractAddress(
                event.blockchain,
                contractName,
                newContractAddress,
            );

            this.invalidatedContracts.add(contractName);

            await this.repositoryModuleManager.updateLastCheckedBlock(
                event.blockchain,
                [contractName],
                event.blockNumber,
                Date.now(),
                { transaction: repositoryTransaction },
            );
        }
    }

    async handleNewAssetStorageEvent(event, repositoryTransaction) {
        const { contractName, newContractAddress } = JSON.parse(event.data);

        const blockchchainModuleContractAddress = this.blockchainModuleManager.getContractAddress(
            event.blockchain,
            contractName,
        );

        if (newContractAddress !== blockchchainModuleContractAddress) {
            this.blockchainModuleManager.initializeAssetStorageContract(
                event.blockchain,
                newContractAddress,
            );
        }

        const blockchainEventsServiceContractAddress =
            this.blockchainEventsService.getContractAddress(event.blockchain, contractName);

        if (newContractAddress !== blockchainEventsServiceContractAddress) {
            this.blockchainEventsService.updateContractAddress(
                event.blockchain,
                contractName,
                newContractAddress,
            );

            this.invalidatedContracts.add(contractName);

            await this.repositoryModuleManager.updateLastCheckedBlock(
                event.blockchain,
                [contractName],
                event.blockNumber,
                Date.now(),
                { transaction: repositoryTransaction },
            );
        }
    }

    async handleAssetStorageChangedEvent(event, repositoryTransaction) {
        const { contractName, newContractAddress } = JSON.parse(event.data);

        const blockchchainModuleContractAddress = this.blockchainModuleManager.getContractAddress(
            event.blockchain,
            contractName,
        );

        if (newContractAddress !== blockchchainModuleContractAddress) {
            this.blockchainModuleManager.initializeAssetStorageContract(
                event.blockchain,
                newContractAddress,
            );
        }

        const blockchainEventsServiceContractAddress =
            this.blockchainEventsService.getContractAddress(event.blockchain, contractName);

        if (newContractAddress !== blockchainEventsServiceContractAddress) {
            this.blockchainEventsService.updateContractAddress(
                event.blockchain,
                contractName,
                newContractAddress,
            );

            this.invalidatedContracts.add(contractName);

            await this.repositoryModuleManager.updateLastCheckedBlock(
                event.blockchain,
                [contractName],
                event.blockNumber,
                Date.now(),
                { transaction: repositoryTransaction },
            );
        }
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
