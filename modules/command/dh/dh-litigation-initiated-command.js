const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

/**
 * Repeatable command that checks whether litigation is successfully initiated
 */
class DHLitigationInitiatedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.dhService = ctx.dhService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        try {
            const events = await Models.events.findAll({
                where: {
                    event: 'LitigationInitiated',
                    finished: 0,
                },
            });
            if (events) {
                const event = events.find((e) => {
                    const {
                        holderIdentity,
                    } = JSON.parse(e.data);
                    return Utilities.compareHexStrings(holderIdentity, this.config.erc725Identity);
                });
                if (event) {
                    event.finished = true;
                    await event.save({ fields: ['finished'] });

                    const {
                        offerId,
                        requestedDataIndex,
                    } = JSON.parse(event.data);

                    await this.dhService.handleLitigation(offerId, requestedDataIndex);
                }
            }
        } catch (e) {
            this.logger.error(`Failed to process LitigationInitiatedCommand. ${e}`);
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
            name: 'dhLitigationInitiatedCommand',
            data: {
            },
            delay: 0,
            period: 5000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHLitigationInitiatedCommand;
