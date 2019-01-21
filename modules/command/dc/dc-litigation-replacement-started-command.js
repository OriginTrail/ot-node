const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

class DCLitigationReplacementStartedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
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

                this.logger.important(`Replacement for DH ${dhIdentity} and offer ${offerId} has been successfully started. Waiting for DHs...`);

                const offer = await models.offers.findOne({
                    where: {
                        offer_id: offerId,
                    },
                });

                return {
                    commands: [
                        {
                            name: 'dcOfferChooseCommand',
                            data: {
                                internalOfferId: offer.id,
                                isReplacement: true,
                                dhIdentity,
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
