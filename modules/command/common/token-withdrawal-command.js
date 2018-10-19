const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Starts token withdrawal operation
 */
class TokenWithdrawalCommand extends Command {
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
            amount,
        } = command.data;
        await this.blockchain.withdrawTokens(Utilities.normalizeHex(this.config.erc725Identity));
        this.logger.important(`Token withdrawal for amount ${amount} completed.`);
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'tokenWithdrawalCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = TokenWithdrawalCommand;
