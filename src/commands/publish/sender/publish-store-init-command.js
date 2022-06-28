const ProtocolInitCommand = require('../../common/protocol-init-command');
const {
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    PUBLISH_REQUEST_STATUS,
} = require('../../../constants/constants');

class PublishStoreInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);

        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.publishService = ctx.publishService;

        this.errorType = ERROR_TYPE.STORE_INIT_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.STORE;
    }

    async prepareMessage(command) {
        const { assertionId } = command.data;

        return { assertionId };
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.publishService.processPublishResponse(
            command,
            PUBLISH_REQUEST_STATUS.FAILED,
            errorMessage,
        );
    }

    async retryFinished(command) {
        await this.markResponseAsFailed(
            command,
            'Max number of retries for protocol store init message reached',
        );
    }

    /**
     * Builds default storeInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishStoreInitCommand',
            delay: 0,
            period: 5000,
            retries: 3,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishStoreInitCommand;
