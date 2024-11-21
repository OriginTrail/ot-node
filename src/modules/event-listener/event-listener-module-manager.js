import BaseModuleManager from '../base-module-manager.js';

class EventListenerModuleManager extends BaseModuleManager {
    async initializeBlockchainEventListener(eventListenerImplementation, blockchainConfig) {
        if (this.getImplementation(eventListenerImplementation)) {
            return this.getImplementation(
                eventListenerImplementation,
            ).module.initializeBlockchainEventListener(blockchainConfig);
        }
    }

    async getAllPastEvents(
        eventListenerImplementation,
        blockchainId,
        contractName,
        eventsToFilter,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        if (this.getImplementation(eventListenerImplementation)) {
            return this.getImplementation(eventListenerImplementation).module.getAllPastEvents(
                blockchainId,
                contractName,
                eventsToFilter,
                lastCheckedBlock,
                lastCheckedTimestamp,
                currentBlock,
            );
        }
    }

    getName() {
        return 'eventListener';
    }
}

export default EventListenerModuleManager;
