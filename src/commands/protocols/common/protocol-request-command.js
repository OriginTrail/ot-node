/* eslint-disable import/extensions */
import Command from '../../command.js';
import ProtocolMessageCommand from './protocol-message-command.js';
import { NETWORK_MESSAGE_TYPES } from '../../../constants/constants.js';

class ProtocolRequestCommand extends ProtocolMessageCommand {
    async execute(command) {
        return this.executeProtocolMessageCommand(
            command,
            NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST,
        );
    }

    async handleAck(command, responseData) {
        await this.operationService.processResponse(
            command,
            this.operationService.getOperationRequestStatus().COMPLETED,
            responseData,
        );
        return Command.empty();
    }
}

export default ProtocolRequestCommand;
