const Graph = require('./Graph');
const Challenge = require('./Challenge');
const config = require('./Config');

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
        this.log = ctx.logger;
    }

    /**
     * Sends data to DH for replication
     *
     * @param data object {VERTICES, EDGES, IMPORT_ID} This is the payload to be sent
     * @return object response
     */
    async sendPayload(data) {
        this.log.info('Entering sendPayload');

        const currentUnixTime = Date.now();
        const options = {
            dh_wallet: config.dh_wallet,
            import_id: data.import_id,
            amount: data.vertices.length + data.edges.length,
            start_time: currentUnixTime,
            total_time: 10 * 60000,
        };

        data.vertices = Graph.sortVertices(data.vertices);

        // TODO: Move test generation outside sendPayload(.
        const tests = Challenge.generateTests(
            data.contact, options.import_id.toString(), 10,
            options.start_time, options.start_time + options.total_time,
            32, data.vertices,
        );

        Challenge.addTests(tests).then(() => {
            this.log.trace(`Tests generated for DH ${tests[0].dhId}`);
        }, () => {
            this.log.error(`Failed to generate challenges for ${config.identity}, import ID ${options.import_id}`);
        });

        const payload = {
            payload: {
                edges: data.edges,
                import_id: data.import_id,
                dc_wallet: config.blockchain.wallet_address,
                public_key: data.public_key,
                vertices: data.vertices,
                root_hash: data.root_hash,
            },
        };

        // send payload to DH
        this.network.kademlia().payloadRequest(payload, data.contact, () => {
            this.log.info('Payload request sent');
        });
    }
}

module.exports = DataReplication;
