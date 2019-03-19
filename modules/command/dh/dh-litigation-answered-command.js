const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

/**
 * Repeatable command that checks whether DH answered the litigation
 */
class DHLitigationAnsweredCommand extends Command {
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

        const events = await Models.events.findAll({
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
                return Utilities.compareHexStrings(offerId, eventOfferId)
                    && Utilities.compareHexStrings(dhIdentity, holderIdentity);
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                this.logger.important(`Litigation answered for offer ${offerId}. DH identity ${dhIdentity}`);
                return Command.empty();
            }
        }
        return Command.repeat();
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
            name: 'dhLitigationAnsweredCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHLitigationAnsweredCommand;
