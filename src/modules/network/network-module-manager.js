import BaseModuleManager from '../base-module-manager.js';

class NetworkModuleManager extends BaseModuleManager {
    getName() {
        return 'network';
    }

    serializePeers(peer) {
        if (this.initialized) {
            return this.getImplementation().module.serializePeers(peer);
        }
    }

    deserializePeers(serializedPeers) {
        if (this.initialized) {
            return this.getImplementation().module.deserializePeers(serializedPeers);
        }
    }

    async sortPeers(key, peerIds, count) {
        if (this.initialized) {
            return this.getImplementation().module.sortPeers(key, peerIds, count);
        }
    }

    async findNodes(key) {
        if (this.initialized) {
            return this.getImplementation().module.findNodes(key);
        }
    }

    async findNodesLocal(key) {
        if (this.initialized) {
            return this.getImplementation().module.findNodesLocal(key);
        }
    }

    getMultiaddrs() {
        if (this.initialized) {
            return this.getImplementation().module.getMultiaddrs();
        }
    }

    getRoutingTableSize() {
        if (this.initialized) {
            return this.getImplementation().module.getRoutingTableSize();
        }
    }

    getPeers() {
        if (this.initialized) {
            return this.getImplementation().module.getPeers();
        }
    }

    async getProtocols(peerId) {
        if (this.initialized) {
            return this.getImplementation().module.getProtocols(peerId);
        }
    }

    async getAddresses(peerId) {
        if (this.initialized) {
            return this.getImplementation().module.getAddresses(peerId);
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

    getPrivateKey() {
        if (this.initialized) {
            return this.getImplementation().module.getPrivateKey();
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
            return this.getImplementation().module.dialPeer(peerId);
        }
    }

    async toHash(key) {
        if (this.initialized) {
            return this.getImplementation().module.toHash(key);
        }
    }
}

export default NetworkModuleManager;
