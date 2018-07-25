const Command = require('../Command');

class BiddingApprovalIncreaseCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { condition, profileBalance } = command.data;
        await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'biddingApprovalIncrease',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = BiddingApprovalIncreaseCommand;
