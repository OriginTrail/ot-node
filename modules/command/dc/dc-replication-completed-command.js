const Command = require('../command');
const utilities = require('../../Utilities');
const encryption = require('../../Encryption');
const models = require('../../../models/index');

/**
 * Handles replication request
 */
class DcReplicationCompletedCommand extends Command {
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
            offerId, dhNodeId,
            dhWallet, dhIdentity,
            signature, isReplacement,
        } = command.data;

        const toValidate = [
            utilities.denormalizeHex(offerId),
            utilities.denormalizeHex(dhIdentity)];
        const address = encryption.extractSignerAddress(toValidate, signature);

        if (address.toUpperCase() !== dhWallet.toUpperCase()) {
            throw new Error(`Failed to validate DH ${dhWallet} signature for offer ${offerId}`);
        }

        const replicatedData = await models.replicated_data.findOne({
            where:
                {
                    offer_id: offerId, dh_id: dhNodeId,
                },
        });
        if (!replicatedData) {
            throw new Error(`Failed to find replication for DH node ${dhNodeId}`);
        }
        replicatedData.confirmation = signature;
        replicatedData.status = 'VERIFIED';
        await replicatedData.save({ fields: ['status', 'confirmation'] });

        if (isReplacement === false) {
            this.logger.notify(`Replication finished for DH node ${dhNodeId}`);
        } else {
            this.logger.notify(`Replacement replication finished for DH node ${dhNodeId}`);
        }
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcReplicationCompletedCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcReplicationCompletedCommand;
