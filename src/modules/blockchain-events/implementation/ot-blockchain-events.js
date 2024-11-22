class OtBlockchainEvents {
    async initialize(config, logger) {
        this.logger = logger;
        this.config = config;
    }

    async initializeImplementation() {
        throw Error('initializeImplementation not implemented');
    }

    async initializeRpcProvider() {
        throw Error('initializeRpcProvider not implemented');
    }

    async getAllPastEvents() {
        throw Error('getAllPastEvents not implemented');
    }
}

export default OtBlockchainEvents;
