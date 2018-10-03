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
    }

    /**
     * Creates an offer in the database
     * @param command
     * @returns {Promise<{commands}>}
     */
    async execute(command) {
        const {
            offerId, wallet, identity,
        } = command.data;
        const offer = models.offers.findOne({ where: { external_id: offerId } });
        if (!offer) {
            return Command.empty();
        }

        const colors = ['red', 'green', 'blue'];
        const color = colors[Utilities.getRandomInt(2)];

        const colorFilePath = path.join(
            this.config.appDataPath,
            this.config.dataSetStorage, offerId, `${color}.json`,
        );

        const replication = JSON.parse(await Utilities.fileContents(colorFilePath));
        await models.replicated_data.create({
            dh_id: identity,
            dh_wallet: wallet,
            offer_id: offerId,
            color,
        });

        const payload = {
            payload: {
                edges: replication.edges,
                vertices: replication.vertices,
                public_key: replication.public_key,
                dc_wallet: this.config.node_wallet,
            },
        };

        // send payload to DH
        await this.transport.payloadRequest(payload, identity);
        this.log.info(`Payload for offer ID ${offerId} sent to ${identity}.`);
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
