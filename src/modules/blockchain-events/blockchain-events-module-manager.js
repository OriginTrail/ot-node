import BaseModuleManager from '../base-module-manager.js';

class BlockchainEventsModuleManager extends BaseModuleManager {
    async getBlock(implementationName, blockchain, tag) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getBlock(blockchain, tag);
        }
    }

    async getPastEvents(
        implementationName,
        blockchain,
        contract,
        contractName,
        eventsToFilter,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getPastEvents(
                blockchain,
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
