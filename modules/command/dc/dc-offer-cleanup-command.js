const Command = require('../command');
const models = require('../../../models/index');

/**
 * Cleans up offer related resources
 */
class DCOfferCleanupCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.replicationService = ctx.replicationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
        } = command.data;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        if (offer == null) {
            throw new Error(`Failed to find offer ${offerId}`);
        }

        offer.status = 'COMPLETED';
        offer.global_status = 'COMPLETED';
        await offer.save({ fields: ['status', 'global_status'] });

        this.replicationService.cleanup(offer.id);
        this.logger.info(`Offer ${offerId} replication data cleanup successful`);

        await models.replicated_data.update(
            {
                status: 'COMPLETED',
            },
            {
                where: {
                    offer_id: offer.offer_id,
                    status: 'HOLDING',
                },
            },
        );
        this.logger.info(`Holders for offer ${offerId} have completed the task.`);
        await this._cleanupChallenges(offerId);
        return Command.empty();
    }

    /**
     * Cleanup offer challenges
     * @param offerId
     * @return {Promise<void>}
     * @private
     */
    async _cleanupChallenges(offerId) {
        // delete pending challenges
        await models.challenges.destroy({
            where: {
                offer_id: offerId,
                status: 'PENDING',
            },
        });
        this.logger.info(`Remove challenges for offer ${offerId}`);
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferCleanupCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferCleanupCommand;
