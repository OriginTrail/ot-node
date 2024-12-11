import Command from '../../../../command.js';
import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import {
    NETWORK_MESSAGE_TIMEOUT_MILLS,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    COMMAND_PRIORITY,
} from '../../../../../constants/constants.js';

class FinalityRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.FINALITY.FINALITY_REQUEST_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_REQUEST_START;
        this.operationEndEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_REQUEST_END;
        this.prepareMessageStartEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REQUEST_PREPARE_MESSAGE_START;
        this.prepareMessageEndEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REQUEST_PREPARE_MESSAGE_END;
        this.sendMessageStartEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REQUEST_SEND_MESSAGE_START;
        this.sendMessageEndEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_REQUEST_SEND_MESSAGE_END;
    }

    async prepareMessage(command) {
        const { ual, publishOperationId, blockchain, operationId } = command.data;

        return { ual, publishOperationId, blockchain, operationId };
    }

    async handleAck(command) {
        await this.operationIdService.updateOperationIdStatus(
            command.operationId,
            command.blockchain,
            OPERATION_ID_STATUS.COMPLETED,
        );
        return this.continueSequence(command.data, command.sequence);
    }

    async handleNack(command, responseData) {
        await this.operationIdService.updateOperationIdStatus(
            command.operationId,
            command.blockchain,
            OPERATION_ID_STATUS.COMPLETED,
        );
        await this.markResponseAsFailed(
            command,
            `Received NACK response from node during ${command.name}. Error message: ${responseData.errorMessage}`,
        );
        return Command.empty();
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.FINALITY.REQUEST;
    }

    /**
     * Builds default finalityRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0FinalityRequestCommand',
            delay: 0,
            retries: 0,
            transactional: false,
            priority: COMMAND_PRIORITY.HIGHEST,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FinalityRequestCommand;
