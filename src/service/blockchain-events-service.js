class BlockchainEventsService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainEventsModuleManager = ctx.blockchainEventsModuleManager;
    }

    initializeBlockchainEventsServices() {
        this.blockchainEventsServicesImplementations = {};
        for (const implementationName of this.blockchainEventsModuleManager.getImplementationNames()) {
            for (const blockchain in this.blockchainEventsModuleManager.getImplementation(
                implementationName,
            ).module.blockchains) {
                this.blockchainEventsServicesImplementations[blockchain] = implementationName;
            }
        }
    }

    async getBlock(blockchain, tag = 'latest') {
        return this.blockchainEventsModuleManager.getBlock(
            this.blockchainEventsServicesImplementations[blockchain],
            blockchain,
            tag,
        );
    }

    async getPastEvents(
        blockchain,
        contractName,
        eventsToFilter,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        return this.blockchainEventsModuleManager.getPastEvents(
            this.blockchainEventsServicesImplementations[blockchain],
            blockchain,
            contractName,
            eventsToFilter,
            lastCheckedBlock,
            lastCheckedTimestamp,
            currentBlock,
        );
    }
}

export default BlockchainEventsService;
