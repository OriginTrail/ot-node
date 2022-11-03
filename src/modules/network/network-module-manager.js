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

    async sortPeers(key, peerIds, count) {
        if (this.initialized) {
            return this.getImplementation().module.sortPeers(key, peerIds, count);
        }
    }

    getMultiaddrs() {
        if (this.initialized) {
            return this.getImplementation().module.getMultiaddrs();
        }
    }

    getPeers() {
        if (this.initialized) {
            return this.getImplementation().module.getPeers();
        }
    }

    async sendMessage(protocol, remotePeerId, messageType, operationId, keyword, message) {
        if (this.initialized) {
            return this.getImplementation().module.sendMessage(
                protocol,
                remotePeerId,
                messageType,
                operationId,
                keyword,
                message,
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

    removeSession(sessionId) {
        if (this.initialized) {
            this.getImplementation().module.removeSession(sessionId);
        }
    }

    getPeerId() {
        if (this.initialized) {
            return this.getImplementation().module.getPeerId();
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

    async toHash(key) {
        if (this.initialized) {
            return this.getImplementation().module.toHash(key);
        }
    }
}

export default NetworkModuleManager;
