const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const constants = require('../../constants');

class DCLitigationCompletedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
        this.errorNotificationService = ctx.errorNotificationService;
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
                event.finished = 1;
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
                replicatedData.last_litigation_timestamp = new Date();
                replicatedData.status = penalized === true ? 'PENALIZED' : 'HOLDING';
                await replicatedData.save({ fields: ['status', 'last_litigation_timestamp'] });

                if (penalized === true) {
                    // remove challenges
                    await models.challenges.destroy({
                        where: {
                            dh_identity: dhIdentity,
                            offer_id: offerId,
                        },
                    });
                    this.logger.info(`Challenges removed for DH with identity ${dhIdentity} and offer ${offerId}.`);

                    await models.reputation_data.create({
                        dh_identity: dhIdentity,
                        offer_id: offerId,
                        reputation_delta: '-1',
                        timestamp: Date.now(),
                    });
                }

                const offer = await models.offers.findOne({
                    where: {
                        offer_id: offerId,
                    },
                });

                const holdingCount = await models.replicated_data.count({
                    where: { offer_id: offerId, status: 'HOLDING' },
                });

                if (holdingCount === 0) {
                    offer.global_status = 'FAILED';
                    await offer.save({ fields: ['global_status'] });
                    this.remoteControl.offerUpdate({
                        offer_id: offerId,
                    });
                }
                return Command.empty();
            }
        }
        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const {
            offerId,
            dhIdentity,
        } = command.data;

        this.logger.error(`Litigation completed command for holder ${dhIdentity} and offer ${offerId} FAILED!`);

        this.errorNotificationService.notifyError(
            err,
            {
                dhIdentity,
                offerId,
            },
            constants.PROCESS_NAME.litigationHandling,
        );

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
