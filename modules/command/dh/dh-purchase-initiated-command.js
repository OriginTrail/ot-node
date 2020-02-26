const Command = require('../command');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DhPurchaseInitiatedCommand extends Command {
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
        // fetch event from bc
        // validate root
        // validate root(ENC(x))
        // validate price
        // deposit key
        // schedule DhPurchaseTakePaymentCommand
    }

    /**
     * Builds default DhPurchaseInitiatedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPurchaseInitiatedCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhPurchaseInitiatedCommand;
