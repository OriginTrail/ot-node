const Graph = require('./Graph');
const Challenge = require('./Challenge');
const config = require('./Config');
const MerkleTree = require('./Merkle');
const Utilities = require('./Utilities');
const Encryption = require('./Encryption');
const ImportUtilities = require('./ImportUtilities');

const log = Utilities.getLogger();

class DataReplication {
    /**
     * Default constructor
     * @param ctx  IoC container context
     */
    constructor(ctx) {
        this.network = ctx.network;
        this.challenger = ctx.challenger;
        this.graphStorage = ctx.graphStorage;
        this.importer = ctx.importer;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Sends data to DH for replication
     *
     * @param data object {VERTICES, EDGES, IMPORT_ID} This is the payload to be sent
     * @return object response
     */
    async sendPayload(data) {
        log.info('Entering sendPayload');

        const currentUnixTime = Date.now();
        const options = {
            dh_wallet: config.dh_wallet,
            import_id: data.import_id,
            amount: data.vertices.length + data.edges.length,
            start_time: currentUnixTime,
            total_time: 10 * 60000,
        };

        data.encryptedVertices.vertices = Graph.sortVertices(data.encryptedVertices.vertices);

        const tests = Challenge.generateTests(
            data.contact, options.import_id.toString(), 10,
            options.start_time, options.start_time + options.total_time,
            32, data.encryptedVertices.vertices,
        );

        Challenge.addTests(tests).then(() => {
            this.challenger.startChallenging();
        }, () => {
            log.error(`Failed to generate challenges for ${config.identity}, import ID ${options.import_id}`);
        });

        const payload = {
            payload: {
                edges: data.edges,
                import_id: data.import_id,
                dc_wallet: config.blockchain.wallet_address,
                public_key: data.encryptedVertices.public_key,
                vertices: data.encryptedVertices.vertices,
            },
        };

        // send payload to DH
        this.network.kademlia().payloadRequest(payload, data.contact, () => {
            log.info('Payload request sent');
        });
    }

    async verifyReplication(importId, epk, encryptionKey) {
        const edges = await this.graphStorage.findEdgesByImportId(importId);
        let vertices = await this.graphStorage.findVerticesByImportId(importId);
        const encryptedVertices = vertices.map((vertex) => {
            vertex.data = Encryption.encryptObject(vertex.data, encryptionKey);
            return vertex;
        });

        const merkle = await ImportUtilities.merkleStructure(encryptedVertices, edges);

        const distributionRootHash = merkle.tree.getRoot();
        const epkHash = Encryption.calculateDataChecksum(epk, 0, 0, 0);
        const decryptionKey = Encryption.unpackEPK(Encryption.globalDecrypt(epk));

        let decryptedVertices = encryptedVertices.map((vertex) => {
            vertex.data = Encryption.decryptObject(vertex.data, decryptionKey);
            return vertex;
        });

        vertices = Graph.sortVertices(vertices);
        decryptedVertices = Graph.sortVertices(decryptedVertices);

        // compare these two
    }
}

module.exports = DataReplication;
