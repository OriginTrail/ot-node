/* eslint-disable import/extensions */
import ProtocolMessageCommand from './protocol-message-command.js';
import { NETWORK_MESSAGE_TYPES } from '../../../constants/constants.js';

class ProtocolInitCommand extends ProtocolMessageCommand {
    async execute(command) {
        return this.executeProtocolMessageCommand(
            command,
            NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT,
        );
    }
}

export default ProtocolInitCommand;
