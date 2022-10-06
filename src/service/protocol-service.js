import { NETWORK_PROTOCOLS } from '../constants/constants.js';

class ProtocolService {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;

        this.latestProtocols = Object.keys(NETWORK_PROTOCOLS).map(
            (protocol) => NETWORK_PROTOCOLS[protocol][0],
        );
    }

    toAwilixVersion(protocol) {
        const { version } = this.resolveProtocol(protocol);
        return `v${version.split('.').join('_')}`;
    }

    resolveProtocol(protocol) {
        const [, name, version] = protocol.split('/');
        return { name, version };
    }

    isLatest(protocol) {
        this.latestProtocols.includes(protocol);
    }

    getProtocols() {
        return Object.values(NETWORK_PROTOCOLS);
    }

    toOperation(protocol) {
        const { name } = this.resolveProtocol(protocol);
        switch (name) {
            case 'store':
                return 'publish';
            default:
                return name;
        }
    }

    getReceiverCommandSequence(protocol) {
        const version = this.protocolService.toAwilixVersion(protocol);
        const { name } = this.protocolService.resolveProtocol(protocol);
        const capitalizedOperation = name.charAt(0).toUpperCase() + name.slice(1);

        const prefix = this.protocolService.isLatest(protocol)
            ? `handle${capitalizedOperation}`
            : `${version}Handle${capitalizedOperation}`;

        return [`${prefix}InitCommand`, `${prefix}RequestCommand`];
    }

    getSenderCommandSequence(protocol) {
        const version = this.protocolService.toAwilixVersion(protocol);
        const operation = this.operationService.getOperationName();
        const capitalizedOperation = operation.charAt(0).toUpperCase() + operation.slice(1);

        const prefix = this.protocolService.isLatest(protocol)
            ? `${operation}`
            : `${version}${capitalizedOperation}`;

        return [`${prefix}InitCommand`, `${prefix}RequestCommand`];
    }
}

export default ProtocolService;
