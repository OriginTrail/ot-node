class OtEventListener {
    async initialize(config, logger) {
        this.logger = logger;
        this.config = config;
    }

    async initializeAndStartEventListener() {
        throw Error('initializeAndStartEventListener not implemented');
    }
}

export default OtEventListener;
