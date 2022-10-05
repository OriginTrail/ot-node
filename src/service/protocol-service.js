class ProtocolService {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    toAwilixVersion(protocol) {
        const { version } = this.resolveProtocol(protocol);
        return `v${version.split('.').join('_')}`;
    }

    resolveProtocol(protocol) {
        const [, name, version] = protocol.split('/');
        return { name, version };
    }
}

export default ProtocolService;
