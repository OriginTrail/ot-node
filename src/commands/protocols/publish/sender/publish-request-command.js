const ProtocolRequestCommand = require('../../common/protocol-request-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class PublishRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const { handlerId, assertionId, metadata, ual } = command.data;
        const { data } = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        return {
            metadata,
            data,
            assertionId,
            ual,
        };
    }

    /**
     * Builds default storeRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishRequestCommand;
