const Command = require('../command');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DvPurchaseDisputeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        // send dispute purchase to bc

        this.remoteControl.purchaseStatus('Purchase not confirmed', 'Sending dispute purchase to Blockchain.', true);
    }

    /**
     * Builds default DvPurchaseDisputeCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPurchaseDisputeCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DvPurchaseDisputeCommand;
