const Command = require('../command');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DvPurchaseKeyDepositedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        // get key deposited event from bc
        // if no event try again in x min
        // when event received validate encoded data
        // if ok update tables
        // if !ok call purchase dispute command
    }

    /**
     * Builds default DvPurchaseKeyDepositedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPurchaseKeyDepositedCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DvPurchaseKeyDepositedCommand;
