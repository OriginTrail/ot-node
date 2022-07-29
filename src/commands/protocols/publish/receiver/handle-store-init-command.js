const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const {
    NETWORK_MESSAGE_TYPES,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
} = require('../../../../constants/constants');
const Command = require("../../../command");

class HandleStoreInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { operationId, ual } = commandData;
        try {
            const assertionId = await this.operationService.getAssertion(ual, operationId);
            await this.operationIdService.cacheOperationIdData(operationId,{ assertionId });
        }  catch (error) {
            console.log(error);
            // TODO implement retry
        }
        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    // async retryFinished(command) {
    //     const { operationId } = command.data;
    //     const message = `Retry count for command: ${command.name} reached! Unable to validate data for operation id: ${operationId}`;
    //     this.logger.trace(message);
    //     await this.handleError(operationId, message, this.errorType, true);
    //     // TODO return NACK
    // }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        // TODO implement retry
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
