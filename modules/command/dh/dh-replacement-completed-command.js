const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

/**
 * Imports data for replication
 */
class DHReplacementCompleted extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.profileService = ctx.profileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
        } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'ReplacementCompleted',
                finished: 0,
            },
        });
        if (events) {
            const event = events.find((e) => {
                const {
                    offerId: eventOfferId,
                    challengerIdentity,
                } = JSON.parse(e.data);
                // todo pass blockchain identity
                return Utilities.compareHexStrings(offerId, eventOfferId) &&
                !Utilities.compareHexStrings(challengerIdentity, this.profileService.getIdentity());
            });
            if (event) {
                event.finished = 1;
                await event.save({ fields: ['finished'] });

                const {
                    chosenHolder,
                } = JSON.parse(event.data);

                // todo pass blockchain identity
                if (Utilities.compareHexStrings(chosenHolder, this.profileService.getIdentity())) {
                    this.logger.important(`Chosen as a replacement for offer ${offerId}.`);

                    const bid = await Models.bids.findOne({ where: { offer_id: offerId } });

                    bid.status = 'CHOSEN';
                    await bid.save({ fields: ['status'] });

                    if (this.config.disableAutoPayouts !== true) {
                        const scheduledTime =
                            (bid.holding_time_in_minutes * 60 * 1000) + (60 * 1000);
                        return {
                            commands: [
                                {
                                    name: 'dhPayOutCommand',
                                    delay: scheduledTime,
                                    retries: 3,
                                    transactional: false,
                                    data: {
                                        offerId,
                                        viaAPI: false,
                                    },
                                },
                            ],
                        };
                    }
                }

                this.logger.important(`Not chosen as a replacement for offer ${offerId}.`);
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
            name: 'dhReplacementCompleted',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHReplacementCompleted;
