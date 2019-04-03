const { forEach } = require('p-iteration');

const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

const { Op } = Models.Sequelize;

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DcOfferFinalizedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.replicationService = ctx.replicationService;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { offerId } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'OfferFinalized',
                finished: 0,
            },
        });
        if (events) {
            const event = events.find((e) => {
                const {
                    offerId: eventOfferId,
                } = JSON.parse(e.data);
                return Utilities.compareHexStrings(offerId, eventOfferId);
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                this.logger.important(`Offer ${offerId} finalized`);

                const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
                offer.status = 'FINALIZED';
                offer.message = 'Offer has been finalized';
                await offer.save({ fields: ['status', 'message'] });
                this.remoteControl.offerUpdate({
                    offer_id: offerId,
                });

                await this._setHolders(offer, event);
                await this.replicationService.cleanup(offer.id);
                return Command.empty();
            }
        }
        return Command.repeat();
    }

    /**
     * Update DHs to Holders
     * @param offer - Offer
     * @param event - OfferFinalized event
     * @return {Promise<void>}
     * @private
     */
    async _setHolders(offer, event) {
        const {
            holder1,
            holder2,
            holder3,
        } = JSON.parse(event.data);

        const holders = [holder1, holder2, holder3].map(h => Utilities.normalizeHex(h));
        await forEach(holders, async (holder) => {
            const replicatedData = await Models.replicated_data.findOne({
                where: {
                    offer_id: offer.offer_id,
                    dh_identity: holder,
                },
            });
            replicatedData.status = 'HOLDING';
            await replicatedData.save({ fields: ['status'] });
        });

        // clear old replicated data
        await Models.replicated_data.destroy({
            where: {
                offer_id: offer.offer_id,
                status: {
                    [Op.in]: ['STARTED', 'VERIFIED'],
                },
            },
        });
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { offerId } = command.data;
        this.logger.notify(`Offer ${offerId} has not been finalized.`);

        const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
        offer.status = 'FAILED';
        offer.message = `Offer for ${offerId} has not been finalized.`;
        await offer.save({ fields: ['status', 'message'] });
        this.remoteControl.offerUpdate({
            offer_id: offerId,
        });

        await this.replicationService.cleanup(offer.id);
        return Command.empty();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferFinalizedCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcOfferFinalizedCommand;
