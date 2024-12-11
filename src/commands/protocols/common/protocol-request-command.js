import Command from '../../command.js';
import ProtocolMessageCommand from './protocol-message-command.js';
import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_REQUEST_STATUS,
    OPERATION_ID_STATUS,
} from '../../../constants/constants.js';

class ProtocolRequestCommand extends ProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationStartEvent = OPERATION_ID_STATUS.PROTOCOL_REQUEST_START;
        this.operationEndEvent = OPERATION_ID_STATUS.PROTOCOL_REQUEST_END;
    }

    async execute(command) {
        const { operationId, blockchain } = command.data;
        this.operationIdService.emitChangeEvent(this.operationStartEvent, operationId, blockchain);
        const result = this.executeProtocolMessageCommand(
            command,
            NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST,
        );
        this.operationIdService.emitChangeEvent(this.operationEndEvent, operationId, blockchain);

        return result;
    }

    async handleAck(command, responseData) {
        await this.operationService.processResponse(
            command,
            OPERATION_REQUEST_STATUS.COMPLETED,
            responseData,
        );
        return Command.empty();
    }
}

export default ProtocolRequestCommand;
