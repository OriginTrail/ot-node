const Command = require('../command');
const Models = require('../../../models/index');

/**
 * Finalizes offer on blockchain
 */
class DCOfferFinalizeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            wallets,
        } = command.data;

        await this.blockchain.finalizeOffer(
            offerId,
            wallets[0],
            wallets[1],
            wallets[2],
        );
        return {
            commands: [
                {
                    name: 'dcOfferFinalizedCommand',
                    data: { offerId },
                },
            ],
        };
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferFinalizeCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferFinalizeCommand;
