const Command = require('../command');
const Utilities = require('../../Utilities');

const Models = require('../../../models');

/**
 * Starts token withdrawal operation
 */
class PayOutCommand extends Command {
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
        } = command.data;

        const bid = await Models.bids.findOne({
            where: { offer_id: offerId },
        });
        if (bid) {
            this.logger.important(`There is no bid for offer ${offerId}. Cannot execute payout.`);
            return;
        }
        await this.blockchain.payOut(Utilities.normalizeHex(this.config.erc725Identity), offerId);
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'payOutCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PayOutCommand;
