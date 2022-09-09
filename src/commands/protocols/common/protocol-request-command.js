const Command = require('../../command');
const ProtocolMessageCommand = require('./protocol-message-command');
const { NETWORK_MESSAGE_TYPES } = require('../../../constants/constants');

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

module.exports = ProtocolRequestCommand;
