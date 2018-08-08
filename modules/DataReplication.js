const Graph = require('./Graph');
const Challenge = require('./Challenge');
const config = require('./Config');
const Models = require('../models');
const ImportUtilities = require('./ImportUtilities');

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
        const currentUnixTime = Date.now();
        const options = {
            dh_wallet: config.dh_wallet,
            import_id: data.import_id,
            amount: data.vertices.length + data.edges.length,
            start_time: currentUnixTime,
            total_time: parseInt(config.total_escrow_time_in_milliseconds, 10), // TODO introduce BN
        };

        ImportUtilities.sort(data.vertices);

        // TODO: Move test generation outside sendPayload(.
        const tests = Challenge.generateTests(
            data.contact, options.import_id.toString(), 20,
            options.start_time, options.start_time + options.total_time,
            32, data.vertices,
        );

        Challenge.addTests(tests).then(() => {
            this.log.trace(`Tests generated for DH ${tests[0].dhId}`);
        }, () => {
            this.log.error(`Failed to generate challenges for ${config.identity}, import ID ${options.import_id}`);
        });

        const dataimport = await Models.data_info.findOne({ where: { import_id: data.import_id } });
        const payload = {
            payload: {
                edges: data.edges,
                import_id: data.import_id,
                dc_wallet: config.blockchain.wallet_address,
                public_key: data.public_key,
                vertices: data.vertices,
                root_hash: data.root_hash,
                data_provider_wallet: dataimport.data_provider_wallet,
            },
        };

        // send payload to DH
        await this.network.kademlia().payloadRequest(payload, data.contact, () => {
            this.log.info(`Payload for import ${data.import_id} sent to ${data.contact}.`);
        });
    }
}

module.exports = DataReplication;
