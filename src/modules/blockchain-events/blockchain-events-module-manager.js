import BaseModuleManager from '../base-module-manager.js';

class BlockchainEventsModuleManager extends BaseModuleManager {
    getContractAddress(implementationName, blockchain, contractName) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getContractAddress(
                blockchain,
                contractName,
            );
        }
    }

    updateContractAddress(implementationName, blockchain, contractName, contractAddress) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.updateContractAddress(
                blockchain,
                contractName,
                contractAddress,
            );
        }
    }

    async getBlock(implementationName, blockchain, tag) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getBlock(blockchain, tag);
        }
    }

    async getPastEvents(
        implementationName,
        blockchain,
        contractNames,
        eventsToFilter,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getPastEvents(
                blockchain,
                contractNames,
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
