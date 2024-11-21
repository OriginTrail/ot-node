class OtEventListener {
    async initialize(config, logger) {
        this.logger = logger;
        this.config = config;
    }

    async initializeBlockchainEventListener() {
        throw Error('initializeBlockchainEventListener not implemented');
    }

    async initializeRpcProvider() {
        throw Error('initializeRpcProvider not implemented');
    }

    async getAllPastEvents() {
        throw Error('getAllPastEvents not implemented');
    }
}

export default OtEventListener;
