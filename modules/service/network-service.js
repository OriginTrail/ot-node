const { v1: uuidv1 } = require('uuid');
const Libp2p = require('../../external/libp2p-service');

class NetworkService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.rankingService = ctx.rankingService;
    }

    initialize() {
        this.implementation = new Libp2p({
            bootstrapMultiAddress: this.config.network.bootstrap,
        });
        return this.implementation.initialize(this.logger);
    }

    getName() {
        return this.implementation.getName();
    }

    /**
     * Retrieve the closest peers to the given key.
     *
     * @param {String} key
     * @param {Number} limit
     * @returns Promise{Iterable<PeerId>}
     */
    async findNodes(key, limit) {
        const Id_operation = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of find nodes', Event_name: 'find_nodes_start', Operation_name: 'find_nodes', Id_operation,
        });
        this.logger.emit({
            msg: 'Started measuring execution of kad find nodes', Event_name: 'kad_find_nodes_start', Operation_name: 'find_nodes', Id_operation,
        });
        const nodes = await this.implementation.findNodes(key, limit);
        this.logger.emit({
            msg: 'Finished measuring execution of kad find nodes ', Event_name: 'kad_find_nodes_end', Operation_name: 'find_nodes', Id_operation,
        });
        this.logger.emit({
            msg: 'Started measuring execution of rank nodes', Event_name: 'rank_nodes_start', Operation_name: 'find_nodes', Id_operation,
        });
        const rankedNodes = await this.rankingService.rank(nodes, key, ['kad-identity']);
        this.logger.emit({
            msg: 'Finished measuring execution of rank nodes', Event_name: 'rank_nodes_end', Operation_name: 'find_nodes', Id_operation,
        });
        this.logger.emit({
            msg: 'Finished measuring execution of find nodes', Event_name: 'find_nodes_end', Operation_name: 'find_nodes', Id_operation,
        });
        return rankedNodes;
    }

    /**
     * Search for a peer with the given ID.
     *
     * @param {PeerId} id
     * @param {Object} [options] - findPeer options
     * @param {number} [options.timeout=60000] - how long the query
     * should maximally run, in milliseconds
     * @returns {Promise<{ id: PeerId, multiaddrs: Multiaddr[] }>}
     */
    findPeer(peerId, options) {
        return this.implementation.findPeer(peerId, options);
    }

    getPeers() {
        return this.implementation.getPeers();
    }

    /**
     * Store the given key/value pair at the peer `target`.
     *
     * @param {String} key
     * @param {Object} object - value to be stored
     * @param {PeerId} target
     */
    store(peer, key, object) {
        return this.implementation.store(peer, key, object);
    }

    handleMessage(eventName, handler, options) {
        this.implementation.handleMessage(eventName, handler, options);
    }

    async sendMessage(eventName, data, peerId) {
        return this.implementation.sendMessage(eventName, data, peerId);
    }

    getPeerId() {
        return this.implementation.getPeerId();
    }

    getPrivateKey() {
        return this.implementation.getPrivateKey();
    }

    async healthCheck() {
        return this.implementation.healthCheck();
    }

    async restartService() {
        return this.implementation.restartService();
    }
}

module.exports = NetworkService;
