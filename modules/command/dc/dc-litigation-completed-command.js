const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

const { Op } = models.Sequelize;

class DCLitigationCompleted extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
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
                event: 'LitigationCompleted',
                finished: 0,
            },
        });
        if (events) {
            const event = events.find((e) => {
                const {
                    offerId: eventOfferId,
                    holderIdentity,
                } = JSON.parse(e.data);
                return utilities.compareHexStrings(offerId, eventOfferId)
                    && utilities.compareHexStrings(dhIdentity, holderIdentity);
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                const {
                    DH_was_penalized: penalized,
                } = JSON.parse(event.data);

                this.logger.notify(`Litigation completed for DH ${dhIdentity} and offer ${offerId}. ${penalized ? 'DH was penalized' : 'DH was not penalized'}`);

                const replicatedData = await models.replicated_data.findOne({
                    where: { offer_id: offerId, dh_identity: dhIdentity },
                });

                if (penalized === true) {
                    replicatedData.status = 'PENALIZED';
                } else {
                    replicatedData.status = 'HOLDING';
                }
                await replicatedData.save({ fields: ['status'] });

                if (penalized) {
                    const replacementEvent = await this._findReplacementEvent(offerId, dhIdentity);
                    if (!replacementEvent) {
                        throw new Error(`Failed to find replacement event from blockchain for DH ${dhIdentity} and offer ${offerId}.`);
                    }

                    // clear old replicated data
                    await models.replicated_data.destroy({
                        where: {
                            offer_id: offerId,
                            [Op.in]: ['STARTED', 'VERIFIED'],
                        },
                    });

                    const offer = models.offers.findOne({
                        where: {
                            offer_id: offerId,
                        },
                    });

                    const replacementOffer = await models.offers.create({
                        data_set_id: `${offer.data_set_id}_R`, // this is a replacement data_set_id
                        message: 'Replacement offer is pending.',
                        status: 'PENDING',
                        parent_id: offer.id,
                        is_replacement: true,
                    });

                    this.logger.important(`Replacement for DH ${dhIdentity} and offer ${offerId} has been successfully started. Waiting for DHs...`);
                    return {
                        commands: [
                            {
                                name: 'dcOfferChooseCommand',
                                data: {
                                    internalOfferId: replacementOffer.id,
                                },
                                delay: this.config.dc_choose_time,
                                transactional: false,
                            },
                        ],
                    };
                }

                this.logger.important(`DH ${dhIdentity} has successfully answered litigation.`);
                return Command.empty();
            }
        }
        return Command.repeat();
    }

    /**
     * Finds replacement event for the DH
     * @param offerId - Offer ID
     * @param dhIdentity - Penalized node
     * @return {Promise<*>}
     * @private
     */
    async _findReplacementEvent(offerId, dhIdentity) {
        const events = await models.events.findAll({
            where: {
                event: 'ReplacementCompleted',
                finished: 0,
            },
        });
        if (events) {
            return events.find((e) => {
                const {
                    offerId: eventOfferId,
                    holderIdentity,
                } = JSON.parse(e.data);
                return utilities.compareHexStrings(offerId, eventOfferId)
                    && utilities.compareHexStrings(dhIdentity, holderIdentity);
            });
        }
        return null;
    }

    /**
     * Builds default DCLitigationCompletedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            data: {
            },
            name: 'dcLitigationCompletedCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCLitigationCompleted;
