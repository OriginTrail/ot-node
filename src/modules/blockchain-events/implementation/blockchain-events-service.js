class BlockchainEventsService {
    async initialize(config, logger) {
        this.logger = logger;
        this.config = config;
    }

    getContractAddress() {
        throw Error('getContractAddress not implemented');
    }

    updateContractAddress() {
        throw Error('updateContractAddress not implemented');
    }

    async getBlock() {
        throw Error('getBlock not implemented');
    }

    async getPastEvents() {
        throw Error('getPastEvents not implemented');
    }
}

export default BlockchainEventsService;
