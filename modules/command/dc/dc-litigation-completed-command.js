const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

class DCLitigationCompletedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
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

                this.logger.important(`Litigation completed for DH ${dhIdentity} and offer ${offerId}.`);
                if (penalized === true) {
                    this.logger.notify(`DH ${dhIdentity} was penalized for the offer ${offerId}.`);
                } else {
                    this.logger.notify(`DH ${dhIdentity} was not penalized for the offer ${offerId}.`);
                }

                const replicatedData = await models.replicated_data.findOne({
                    where: { offer_id: offerId, dh_identity: dhIdentity },
                });

                replicatedData.status = penalized === true ? 'PENALIZED' : 'HOLDING';
                await replicatedData.save({ fields: ['status'] });

                if (penalized === true) {
                    // remove challenges
                    await models.challenges.destroy({
                        where: {
                            dh_identity: dhIdentity,
                            offer_id: offerId,
                        },
                    });
                    this.logger.info(`Challenges removed for DH with identity ${dhIdentity} and offer ${offerId}.`);

                    const offer = await models.offers.findOne({
                        where: {
                            offer_id: offerId,
                        },
                    });

                    offer.global_status = 'REPLACEMENT_STARTED';
                    await offer.save({ fields: ['global_status'] });
                    this.remoteControl.offerUpdate({
                        offer_id: offerId,
                    });

                    const reputationLog = await models.replication_data.create({
                        dh_identity: dhIdentity,
                        offer_id: offerId,
                        reputation_delta: '-1',
                        timestamp: Date.now(),
                    });

                    return {
                        commands: [
                            {
                                data: {
                                    offerId,
                                    dhIdentity,
                                },
                                name: 'dcLitigationReplacementStartedCommand',
                                delay: 0,
                                period: 5000,
                                deadline_at: Date.now() + (5 * 60 * 1000),
                                transactional: false,
                            },
                        ],
                    };
                }

                const offer = await models.offers.findOne({
                    where: {
                        offer_id: offerId,
                    },
                });

                offer.global_status = 'ACTIVE';
                await offer.save({ fields: ['global_status'] });
                this.remoteControl.offerUpdate({
                    offer_id: offerId,
                });
                this.logger.important(`DH ${dhIdentity} has successfully answered litigation.`);
                return Command.empty();
            }
        }
        return Command.repeat();
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

module.exports = DCLitigationCompletedCommand;
