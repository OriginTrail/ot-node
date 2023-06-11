import HandleProtocolMessageCommand from './handle-protocol-message-command.js';

class HandleProtocolRequestCommand extends HandleProtocolMessageCommand {
    onRequestFinished(operationId, keywordUuid, remotePeerId) {
        this.networkModuleManager.removeCachedSession(operationId, keywordUuid, remotePeerId);
    }
}

export default HandleProtocolRequestCommand;
