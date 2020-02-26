const Command = require('../command');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DhPurchaseTakePaymentCommand extends Command {
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
        // if no dispute started send bc take payment
    }

    /**
     * Builds default DhPurchaseTakePaymentCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPurchaseTakePaymentCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhPurchaseTakePaymentCommand;
