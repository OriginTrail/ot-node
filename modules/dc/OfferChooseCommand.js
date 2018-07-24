const Models = require('../../models');
const Command = require('../command/Command');

class OfferChooseCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
    }

    async execute(command) {
        const { offerId } = command.data;
        const offer = await Models.offers.findOne({ where: { id: offerId } });
        this.logger.info(`Choose bids for offer ID ${offer.id}, import ID ${offer.import_id}.`);

        await this.blockchain.increaseApproval(offer.max_token_amount * offer.replication_number);
        await this.blockchain.chooseBids(offer.import_id);
        this.logger.info(`Bids chosen for offer ID ${offer.id}, import ID ${offer.import_id}.`);

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param transaction
     * @param err
     */
    async recover(command, err, transaction) {
        const { offerId } = command.data;
        const offer = await Models.offers.findOne({ where: { id: offerId } });
        this.logger.warn(`Failed call choose bids for offer ID ${offer.id}, import ID ${offer.import_id}. ${err}`);
    }

    /**
     * Builds default OfferChooseCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'offerChoose',
            delay: 30000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OfferChooseCommand;
