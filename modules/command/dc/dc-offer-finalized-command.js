const { forEach } = require('p-iteration');

const Command = require('../command');
const Utilities = require('../../Utilities');
const importUtilitites = require('../../ImportUtilities');
const Models = require('../../../models/index');

const { Op } = Models.Sequelize;

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DcOfferFinalizedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
        this.replicationService = ctx.replicationService;
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
                offer.global_status = 'ACTIVE';
                offer.message = 'Offer has been finalized. Offer is now active.';
                await offer.save({ fields: ['status', 'message', 'global_status'] });

                await this._setHolders(offer, event);

                // clear old replicated data
                await Models.replicated_data.destroy({
                    where: {
                        offer_id: offerId,
                        status: {
                            [Op.in]: ['STARTED', 'VERIFIED'],
                        },
                    },
                });

                const delayOnComplete = 5 * 60 * 1000; // 5 minutes
                const scheduledTime = (offer.holding_time_in_minutes * 60 * 1000) + delayOnComplete;
                return {
                    commands: [
                        {
                            name: 'dcOfferCleanupCommand',
                            data: {
                                offerId,
                            },
                            delay: scheduledTime,
                        },
                    ],
                };
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

        const startTime = Date.now();
        const endTime = startTime + (offer.holding_time_in_minutes * 60 * 1000);
        const vertices = await this.graphStorage.findVerticesByImportId(offer.data_set_id);
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

            const encryptedVertices = importUtilitites.immutableEncryptVertices(
                vertices,
                replicatedData.litigation_private_key,
            );

            const challenges = this.challengeService.generateChallenges(
                encryptedVertices, startTime,
                endTime, this.config.numberOfChallenges,
            );

            await forEach(challenges, async challenge =>
                Models.challenges.create({
                    dh_id: replicatedData.dh_id,
                    dh_identity: replicatedData.dh_identity,
                    data_set_id: offer.data_set_id,
                    block_id: challenge.block_id,
                    expected_answer: challenge.answer,
                    start_time: challenge.time,
                    offer_id: offer.offer_id,
                    status: 'PENDING',
                }));
        });
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { offerId } = command.data;
        this.logger.notify(`Offer ${offerId} has not been finalized.`);

        const offer = await Models.offers.findOne({ where: { id: offerId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = `Offer for ${offerId} has not been finalized.`;
        await offer.save({ fields: ['status', 'message', 'global_status'] });

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
