const { forEach } = require('p-iteration');

const Command = require('../command');
const utilities = require('../../Utilities');
const importUtilities = require('../../ImportUtilities');
const models = require('../../../models/index');

const { Op } = models.Sequelize;

/**
 * Repeatable command that checks whether holder is replaced
 */
class DCOfferReplacementCompletedCommand extends Command {
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
        const {
            offerId,
            dhIdentity,
        } = command.data;

        const events = await models.events.findAll({
            where: {
                event: 'ReplacementCompleted',
                finished: 0,
            },
        });
        if (events.length > 0) {
            const event = events.find((e) => {
                const {
                    offerId: eventOfferId,
                    challengerIdentity,
                } = JSON.parse(e.data);
                return utilities.compareHexStrings(offerId, eventOfferId)
                    && utilities.compareHexStrings(this.config.erc725Identity, challengerIdentity);
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                const offer = await models.offers.findOne({
                    where: {
                        offer_id: offerId,
                    },
                });

                const {
                    chosenHolder,
                } = JSON.parse(event.data);

                const holder = await models.replicated_data.findOne({
                    where: {
                        offer_id: offerId,
                        dh_identity: utilities.normalizeHex(chosenHolder),
                    },
                });

                holder.status = 'HOLDING';
                await holder.save({ fields: ['status'] });

                const startTime = Date.now();
                const endTime = startTime +
                    (offer.holding_time_in_minutes * 60 * 1000);
                const vertices = await this.graphStorage.findVerticesByImportId(offer.data_set_id);

                const encryptedVertices = importUtilities.immutableEncryptVertices(
                    vertices,
                    holder.litigation_private_key,
                );

                const challenges = this.challengeService.generateChallenges(
                    encryptedVertices, startTime,
                    endTime, this.config.numberOfChallenges,
                );

                await forEach(challenges, async challenge =>
                    models.challenges.create({
                        dh_id: holder.dh_id,
                        dh_identity: holder.dh_identity,
                        data_set_id: offer.data_set_id,
                        block_id: challenge.block_id,
                        expected_answer: challenge.answer,
                        start_time: challenge.time,
                        offer_id: offer.offer_id,
                        status: 'PENDING',
                    }));

                // clear old replicated data
                await models.replicated_data.destroy({
                    where: {
                        offer_id: offerId,
                        status: {
                            [Op.in]: ['STARTED', 'VERIFIED'],
                        },
                    },
                });

                offer.global_status = 'ACTIVE';
                await offer.save({ fields: ['global_status'] });

                this.logger.important(`Successfully replaced DH ${dhIdentity} with DH ${chosenHolder} for offer ${offerId}`);
                return Command.empty();
            }
        }
        return Command.repeat();
    }

    /**
     * Builds default
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferReplacementCompletedCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferReplacementCompletedCommand;
