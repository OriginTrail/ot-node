import BaseModuleManager from '../base-module-manager.js';

class NetworkModuleManager extends BaseModuleManager {
    getName() {
        return 'network';
    }

    async onPeerConnected(listener) {
        if (this.initialized) {
            return this.getImplementation().module.onPeerConnected(listener);
        }
    }

    getMultiaddrs() {
        if (this.initialized) {
            return this.getImplementation().module.getMultiaddrs();
        }
    }

    async sendMessage(
        protocol,
        remotePeerId,
        messageType,
        operationId,
        keywordUuid,
        message,
        timeout,
    ) {
        if (this.initialized) {
            return this.getImplementation().module.sendMessage(
                protocol,
                remotePeerId,
                messageType,
                operationId,
                keywordUuid,
                message,
                timeout,
            );
        }
    }

    async sendMessageResponse(protocol, remotePeerId, messageType, operationId, keyword, message) {
        if (this.initialized) {
            return this.getImplementation().module.sendMessageResponse(
                protocol,
                remotePeerId,
                messageType,
                operationId,
                keyword,
                message,
            );
        }
    }

    handleMessage(protocol, handler, options) {
        if (this.initialized) {
            this.getImplementation().module.handleMessage(protocol, handler, options);
        }
    }

    getPeerId() {
        if (this.initialized) {
            return this.getImplementation().module.getPeerId();
        }
    }

    getPeerIdString() {
        if (this.initialized) {
            return this.getImplementation().module.getPeerIdString();
        }
    }

    async healthCheck() {
        if (this.initialized) {
            return this.getImplementation().module.healthCheck();
        }
    }

    async findPeer(peerId) {
        if (this.initialized) {
            return this.getImplementation().module.findPeer(peerId);
        }
    }

    async dial(peerId) {
        if (this.initialized) {
            return this.getImplementation().module.dial(peerId);
        }
    }

    async getPeerInfo(peerId) {
        if (this.initialized) {
            return this.getImplementation().module.getPeerInfo(peerId);
        }
    }

    removeCachedSession(operationId, keywordUuid, remotePeerId) {
        if (this.initialized) {
            this.getImplementation().module.removeCachedSession(
                operationId,
                keywordUuid,
                remotePeerId,
            );
        }
    }
}

export default NetworkModuleManager;
