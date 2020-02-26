const Command = require('../command');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DvPurchaseKeyDepositedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.remoteControl = ctx.remoteControl;
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        this.remoteControl.purchaseStatus('Purchase confirmed', 'Validating and storing data on your local node.');
        // get key deposited event from bc
        // if no event try again in x min
        // when event received validate encoded data
        // if ok update tables
        // if !ok call purchase dispute command
        this.remoteControl.purchaseStatus('Purchase completed','You can preview the purchased data in My Purchases page.');
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
