import BaseModuleManager from '../base-module-manager.js';

class BlockchainEventsModuleManager extends BaseModuleManager {
    async initializeImplementation(blockchainEventsImplementation, blockchainConfig) {
        if (this.getImplementation(blockchainEventsImplementation)) {
            return this.getImplementation(
                blockchainEventsImplementation,
            ).module.initializeImplementation(blockchainConfig);
        }
    }

    async getAllPastEvents(
        blockchainEventsImplementation,
        blockchainId,
        contract,
        contractName,
        eventsToFilter,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        if (this.getImplementation(blockchainEventsImplementation)) {
            return this.getImplementation(blockchainEventsImplementation).module.getAllPastEvents(
                blockchainId,
                contract,
                contractName,
                eventsToFilter,
                lastCheckedBlock,
                lastCheckedTimestamp,
                currentBlock,
            );
        }
    }

    getName() {
        return 'blockchainEvents';
    }
}

export default BlockchainEventsModuleManager;
