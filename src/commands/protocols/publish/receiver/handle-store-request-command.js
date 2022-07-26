const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const {
    NETWORK_MESSAGE_TYPES,
    HANDLER_ID_STATUS,
    ERROR_TYPE,
} = require('../../../../constants/constants');

class HandleStoreRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { ual, handlerId, keywordUuid } = commandData;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_START,
        );
        const assertionId = await this.operationService
            .validateAssertion(ual, handlerId)
            .catch((e) =>
                this.handleError(
                    handlerId,
                    keywordUuid,
                    e.message,
                    ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_REMOTE_ERROR,
                ),
            );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_END,
        );

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );
        await this.operationService
            .localStore(ual, assertionId, handlerId)
            .catch((e) =>
                this.handleError(
                    handlerId,
                    keywordUuid,
                    e.message,
                    ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_ERROR,
                ),
            );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_END,
        );

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default handleStoreRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleStoreRequestCommand;
