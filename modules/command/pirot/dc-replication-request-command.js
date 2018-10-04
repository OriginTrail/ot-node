const path = require('path');

const Command = require('../command');
const Utilities = require('../../Utilities');
const models = require('../../../models/index');

/**
 * Handles replication request
 */
class DCReplicationRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.transport = ctx.transport;
    }

    /**
     * Creates an offer in the database
     * @param command
     * @returns {Promise<{commands}>}
     */
    async execute(command) {
        const {
            externalId, wallet, identity,
        } = command.data;
        const offer = await models.offers.findOne({ where: { external_id: externalId } });
        if (!offer) {
            return Command.empty();
        }

        const colors = ['red', 'green', 'blue'];
        const color = colors[Utilities.getRandomInt(2)];

        const colorFilePath = path.join(
            this.config.appDataPath,
            this.config.dataSetStorage, offer.id, `${color}.json`,
        );

        const replication = JSON.parse(await Utilities.fileContents(colorFilePath));
        await models.replicated_data.create({
            dh_id: identity,
            dh_wallet: wallet,
            offer_id: offer.id,
            public_key: replication.publicKey,
            color,
        });

        const payload = {
            payload: {
                offer_id: externalId,
                data_set_id: offer.data_set_id,
                dc_wallet: this.config.node_wallet,
                edges: replication.edges,
                litigation_vertices: replication.litigationVertices,
                litigation_public_key: replication.litigationPublicKey,
                distribution_public_key: replication.distributionPublicKey,
                distribution_private_key: replication.distributionPrivateKey,
                distribution_epk_checksum: replication.distributionEpkChecksum,
                litigation_root_hash: replication.litigationRootHash,
                distribution_root_hash: replication.distributionRootHash,
                transaction_hash: replication.transaction_hash,
                distribution_epk: replication.distributionEpk,
            },
        };
        // send payload to DH
        await this.transport.payloadRequest(payload, identity);
        this.logger.info(`Payload for offer ID ${offer.id} sent to ${identity}.`);
        return Command.empty();
    }

    /**
     * Builds default dcReplicationRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcReplicationRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCReplicationRequestCommand;
