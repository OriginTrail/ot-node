const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const {
    NETWORK_MESSAGE_TYPES,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
} = require('../../../../constants/constants');

class HandleStoreInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { operationId } = commandData;
        const operationIdRecord = await this.operationService.getOperationIdRecord(operationId);
        if (operationIdRecord && operationIdRecord.status !== OPERATION_ID_STATUS.FAILED) {
            return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
        }
        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK, messageData: {} };
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleStoreInitCommand;
