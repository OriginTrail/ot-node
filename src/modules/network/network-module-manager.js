import BaseModuleManager from '../base-module-manager.js';

class NetworkModuleManager extends BaseModuleManager {
    getName() {
        return 'network';
    }

    async serializePeers(peerIds) {
        if (this.initialized) {
            return this.getImplementation().module.serializePeers(peerIds);
        }
    }

    async deserializePeers(serializedPeers) {
        if (this.initialized) {
            return this.getImplementation().module.deserializePeers(serializedPeers);
        }
    }

    async sortPeerIds(key, peerIds, count) {
        if (this.initialized) {
            return this.getImplementation().module.sortPeerIds(key, peerIds, count);
        }
    }

    async findNodes(key, protocol) {
        if (this.initialized) {
            return this.getImplementation().module.findNodes(key, protocol);
        }
    }

    async findNodesLocal(key, protocol) {
        if (this.initialized) {
            return this.getImplementation().module.findNodesLocal(key, protocol);
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

    getMultiAddrs() {
        if (this.initialized) {
            return this.getImplementation().module.getMultiAddrs();
        }
    }

    /**
     * Store the given key/value pair at the peer `target`.
     *
     * @param {String} key
     * @param {Object} object - value to be stored
     * @param {PeerId} target
     */
    store(peer, key, object) {
        if (this.initialized) {
            return this.getImplementation().module.store(peer, key, object);
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
}

export default NetworkModuleManager;
