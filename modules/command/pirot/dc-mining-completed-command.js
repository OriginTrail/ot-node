const Command = require('../command');
const models = require('../../../models/index');

class DCMiningCompletedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            solution,
            success,
        } = command.data;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        if (success) {
            this.logger.important(`Offer with ID ${offerId} has a solution.`);

            offer.status = 'COMPLETED';
            offer.message = 'Found a solution for DHs provided';
            await offer.save({ fields: ['status', 'message'] });
            return {
                commands: [
                    {
                        name: 'dcOfferFinalizeCommand',
                        data: { offerId, wallets: solution.nodeIdentifiers },
                    },
                ],
            };
        }
        // TODO found no solution, handle this case properly
        this.logger.warn(`Offer with ID ${offerId} has no solution.`);

        offer.status = 'Failed';
        offer.message = 'Failed to find solution for DHs provided';
        await offer.save({ fields: ['status', 'message'] });
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcMiningCompletedCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCMiningCompletedCommand;
