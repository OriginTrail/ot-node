const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

/**
 * Repeatable command that checks whether holder is replaced
 */
class DCOfferReplacementCompletedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
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

                const {
                    chosenHolder,
                } = JSON.parse(event.data);

                const holder = await models.replicated_data.findOne({
                    where: {
                        dh_identity: utilities.normalizeHex(chosenHolder),
                    },
                });

                holder.status = 'HOLDING';
                await holder.save({ fields: ['status'] });

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
