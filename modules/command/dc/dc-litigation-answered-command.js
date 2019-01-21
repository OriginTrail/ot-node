const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

/**
 * Repeatable command that checks whether DH has answered the litigation
 */
class DCLitigationAnsweredCommand extends Command {
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
            blockId,
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
                event.finished = true;
                await event.save({ fields: ['finished'] });

                this.logger.important(`Litigation answered for DH ${dhIdentity} and offer ${offerId}.`);

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
                                dhIdentity,
                                blockId,
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
            blockId,
        } = command.data;

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
                        blockId,
                    },
                    retries: 3,
                    name: 'dcLitigationCompleteCommand',
                },
            ],
        };
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
