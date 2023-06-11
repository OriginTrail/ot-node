import Command from '../../command.js';
import ProtocolMessageCommand from './protocol-message-command.js';
import { NETWORK_MESSAGE_TYPES, OPERATION_REQUEST_STATUS } from '../../../constants/constants.js';

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
            OPERATION_REQUEST_STATUS.COMPLETED,
            responseData,
        );
        return Command.empty();
    }

    onRequestFinished(operationId, keywordUuid, remotePeerId) {
        this.networkModuleManager.removeCachedSession(operationId, keywordUuid, remotePeerId);
    }
}

export default ProtocolRequestCommand;
