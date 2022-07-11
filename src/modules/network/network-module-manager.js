const BaseModuleManager = require('../base-module-manager');

class NetworkModuleManager extends BaseModuleManager {
    getName() {
        return 'network';
    }

    async findNodes(key, protocol) {
        if (this.initialized) {
            return this.getImplementation().module.findNodes(key, protocol);
        }
    }

    getPeers() {
        if (this.initialized) {
            return this.getImplementation().module.getPeers();
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

    async sendMessage(protocol, remotePeerId, messageType, handlerId, keyword, message) {
        if (this.initialized) {
            return this.getImplementation().module.sendMessage(
                protocol,
                remotePeerId,
                messageType,
                handlerId,
                keyword,
                message,
            );
        }
    }

    async sendMessageResponse(protocol, remotePeerId, messageType, handlerId, keyword, message) {
        if (this.initialized) {
            return this.getImplementation().module.sendMessageResponse(
                protocol,
                remotePeerId,
                messageType,
                handlerId,
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

module.exports = NetworkModuleManager;
