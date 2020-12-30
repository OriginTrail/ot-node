const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Repeatable command that checks whether DH has answered the litigation
 */
class DCLitigationAnsweredCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.errorNotificationService = ctx.errorNotificationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            blockchain_id,
            dhIdentity,
            blockIndex,
            objectIndex,
        } = command.data;

        const events = await models.events.findAll({
            where: {
                event: 'LitigationAnswered',
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

                this.logger.important(`Litigation answered for DH ${dhIdentity} and offer ${offerId}.`);

                const offer = await models.offers.findOne({
                    where: { offer_id: offerId },
                });

                if (offer.global_status === 'COMPLETED') {
                    // offer has already been completed
                    this.logger.warn(`Offer ${offerId} has already been completed. Skipping litigation for DH identity ${dhIdentity} with objectIndex ${objectIndex} and blockIndex ${blockIndex}`);
                    return Command.empty();
                }

                const replicatedData = await models.replicated_data.findOne({
                    where: { offer_id: offerId, dh_identity: dhIdentity },
                });
                replicatedData.status = 'LITIGATION_ANSWERED';
                await replicatedData.save({ fields: ['status'] });

                return {
                    commands: [
                        {
                            data: {
                                offerId,
                                blockchain_id,
                                dhIdentity,
                                blockIndex,
                                objectIndex,
                            },
                            retries: 3,
                            name: 'dcLitigationCompleteCommand',
                        },
                    ],
                };
            }
        }
        return Command.repeat();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const {
            offerId,
            dhIdentity,
            objectIndex,
            blockIndex,
        } = command.data;

        this.logger.log(`Litigation answer window timed out for offer ${offerId} and holder ${dhIdentity}`);
        const replicatedData = await models.replicated_data.findOne({
            where: { offer_id: offerId, dh_identity: dhIdentity },
        });
        replicatedData.status = 'LITIGATION_NOT_ANSWERED';
        await replicatedData.save({ fields: ['status'] });

        return {
            commands: [
                {
                    data: {
                        offerId,
                        dhIdentity,
                        objectIndex,
                        blockIndex,
                    },
                    retries: 3,
                    name: 'dcLitigationCompleteCommand',
                },
            ],
        };
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
            objectIndex,
            blockIndex,
        } = command.data;

        this.logger.error(`Initiating answered command for holder ${dhIdentity} and offer ${offerId} FAILED!`);

        this.errorNotificationService.notifyError(
            err,
            {
                objectIndex,
                blockIndex,
                dhIdentity,
                offerId,
            },
            constants.PROCESS_NAME.litigationHandling,
        );

        return Command.retry();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            data: {
            },
            name: 'dcLitigationAnsweredCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCLitigationAnsweredCommand;
