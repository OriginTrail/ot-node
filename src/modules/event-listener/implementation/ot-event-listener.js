class OtEventListener {
    async initialize(config, logger) {
        this.logger = logger;
        this.config = config;
    }

    async initializeEventListener() {
        throw Error('initializeEventListener not implemented');
    }

    async startListeningOnEvents() {
        throw Error('startListeningOnEvents not implemented');
    }
}

export default OtEventListener;
