const { v1: uuidv1 } = require('uuid');

class NetworkService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    initialize(implementation, rankingImplementation) {
        this.network = implementation;
        this.ranking = rankingImplementation;
        return this.network.initialize(this.logger);
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
        this.logger.emit({ msg: 'Started measuring execution of find nodes', Event_name: 'find_nodes_start', Operation_name: 'find_nodes', Id_operation });
        this.logger.emit({ msg: 'Started measuring execution of kad find nodes', Event_name: 'kad_find_nodes_start', Operation_name: 'find_nodes', Id_operation });
        const nodes = await this.network.findNodes(key, limit);
        this.logger.emit({ msg: 'Finished measuring execution of kad find nodes ', Event_name: 'kad_find_nodes_end', Operation_name: 'find_nodes', Id_operation });
        this.logger.emit({ msg: 'Started measuring execution of rank nodes', Event_name: 'rank_nodes_start', Operation_name: 'find_nodes', Id_operation });
        const rankedNodes = await this.ranking.rank(nodes, key, ['kad-identity']);
        this.logger.emit({ msg: 'Finished measuring execution of rank nodes', Event_name: 'rank_nodes_end', Operation_name: 'find_nodes', Id_operation });
        this.logger.emit({ msg: 'Finished measuring execution of find nodes', Event_name: 'find_nodes_end', Operation_name: 'find_nodes', Id_operation });
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
        return this.network.findPeer(peerId, options);
    }

    getPeers() {
        return this.network.getPeers();
    }

    /**
     * Store the given key/value pair at the peer `target`.
     *
     * @param {String} key
     * @param {Object} object - value to be stored
     * @param {PeerId} target
     */
    store(peer, key, object) {
        return this.network.store(peer, key, object);
    }

    handleMessage(eventName, handler, options) {
        this.network.handleMessage(eventName, handler, options);
    }

    async sendMessage(eventName, data, peerId) {
        return await this.network.sendMessage(eventName, data, peerId);
    }

    getPeerId() {
        return this.network.getPeerId();
    }

    getPrivateKey() {
        return this.network.getPrivateKey();
    }

    async healthCheck() {
        return this.network.healthCheck();
    }

    async restartService() {
        return this.network.restartService();
    }
}

module.exports = NetworkService;
