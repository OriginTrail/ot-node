const BN = require('../../../node_modules/bn.js/lib/bn');
const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Starts token withdrawal operation
 */
class TokenWithdrawalStartCommand extends Command {
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

        await this.blockchain.startTokenWithdrawal(
            Utilities.normalizeHex(this.config.erc725Identity),
            new BN(amount, 10),
        );
        return {
            commands: [
                {
                    name: 'tokenWithdrawalWaitStartedCommand',
                    period: 5000,
                    deadline_at: Date.now() + (5 * 60 * 1000),
                    data: command.data,
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
            name: 'tokenWithdrawalStartCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = TokenWithdrawalStartCommand;
