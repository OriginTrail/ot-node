const Models = require('../../../models/index');
const Command = require('../command');

const { Op } = Models.Sequelize;

/**
 * Cancels offer on blockchain if there is one
 */
class DCOfferCancelCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.notifyError = ctx.notifyError;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { importId } = command.data;

        // Check if offer already exists
        const oldOffer = await this.blockchain.getOffer(importId);
        if (oldOffer[0] !== '0x0000000000000000000000000000000000000000') {
            if (oldOffer.active && !oldOffer.finalized) {
                this.logger.info(`Offer for ${importId} exists. Cancelling offer...`);
                await this.blockchain.cancelOffer(importId).catch((error) => {
                    this.notifyError(error);
                    throw new Error(`Cancelling offer failed. ${error}.`);
                });
            } else if (oldOffer.finalized) {
                this.logger.warn(`Offer for ${importId} already exists. Offer is finalized therefore cannot be cancelled.`);
                return Command.empty();
            }

            const offer = await Models.offers.findOne({
                where: {
                    import_id: importId,
                    status: { [Models.Sequelize.Op.not]: ['FINALIZED'] },
                },
                order: [
                    ['id', 'DESC'],
                ],
            });
            if (!offer) {
                this.logger.warn(`Attempt to cancel offer I don't know: ${importId}.`);
                return Command.empty();
            }

            // cancel challenges for cancelled offer
            await Models.replicated_data.update(
                { status: 'CANCELLED' },
                { where: { import_id: importId } },
            );

            offer.status = 'CANCELLED';
            offer.message = 'Offer has been cancelled';
            await offer.save({ fields: ['status', 'message'] });
        }
        this.logger.notify(`Offer ${importId} successfully cancelled.`);
        return this.continueSequence(this.pack(command.data), command.sequence);
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferCancelCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferCancelCommand;
