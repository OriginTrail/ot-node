const ProtocolMessageCommand = require('./protocol-message-command');
const { NETWORK_MESSAGE_TYPES } = require('../../../constants/constants');

class ProtocolInitCommand extends ProtocolMessageCommand {
    async execute(command) {
        return this.executeProtocolMessageCommand(
            command,
            NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT,
        );
    }
}

module.exports = ProtocolInitCommand;
