const { sha256 } = require('multiformats/hashes/sha2');

class KadIdentityRanking {
    initialize(logger) {
        this.logger = logger;
    }

    /**
     * Default distance function. Finds the XOR
     * distance between firstId and secondId.
     *
     * @param  {Uint8Array} firstId  Uint8Array containing first id.
     * @param  {Uint8Array} secondId Uint8Array containing second id.
     * @return {Number}              Integer The XOR distance between firstId
     *                               and secondId.
     */
    distance(firstId, secondId) {
        let distance = 0;
        let i = 0;
        const min = Math.min(firstId.length, secondId.length);
        const max = Math.max(firstId.length, secondId.length);
        for (; i < min; i += 1) {
            distance = distance * 256 + (firstId[i] ^ secondId[i]);
        }
        for (; i < max; i += 1) distance = distance * 256 + 255;
        return distance;
    }

    async execute(nodes, topic, replicationFactor) {
        const encodedKey = new TextEncoder().encode(topic);
        const id = (await sha256.digest(encodedKey)).digest;

        nodes.sort((first_node, second_node) => this.distance(id, first_node._id) - this.distance(id, second_node._id));
        for (const node of nodes) {
            this.logger.info(`XOR distance between topic ${topic} and node ${node._idB58String}: ${this.distance(id, node._id)}`);
        }

        return nodes.slice(0, replicationFactor);
    }
}

module.exports = KadIdentityRanking;
