const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

const { Op } = models.Sequelize;

class DCLitigationReplacementStartedCommand extends Command {
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
                event: 'ReplacementStarted',
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

                // clear old replicated data
                await models.replicated_data.destroy({
                    where: {
                        offer_id: offerId,
                        [Op.in]: ['STARTED', 'VERIFIED'],
                    },
                });

                this.logger.important(`Replacement for DH ${dhIdentity} and offer ${offerId} has been successfully started. Waiting for DHs...`);
                return {
                    commands: [
                        {
                            name: 'dcOfferChooseCommand',
                            data: {
                                offerId,
                                isReplacement: true,
                            },
                            delay: this.config.dc_choose_time,
                            transactional: false,
                        },
                    ],
                };
            }
        }
        return Command.repeat();
    }

    /**
     * Builds default DCLitigationReplacementStartedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            data: {
            },
            name: 'dcLitigationReplacementStartedCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCLitigationReplacementStartedCommand;
