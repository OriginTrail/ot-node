const ProtocolRequestCommand = require('../../common/protocol-request-command');
const {
    NETWORK_PROTOCOLS,
    ERROR_TYPE, PUBLISH_REQUEST_STATUS
} = require('../../../constants/constants');

class PublishStoreRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.publishService = ctx.publishService;
    }

    async prepareMessage(command) {
        // send {metadata, data}


    }

    async handleAck(command) {
        await this.publishService.processPublishResponse(command, PUBLISH_REQUEST_STATUS.COMPLETED);
        return command.empty();
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.publishService.processPublishResponse(command, PUBLISH_REQUEST_STATUS.FAILED, errorMessage);
    }

    /**
     * Builds default storeRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishStoreRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.STORE_REQUEST_ERROR,
            networkProtocol: NETWORK_PROTOCOLS.STORE,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishStoreRequestCommand;
