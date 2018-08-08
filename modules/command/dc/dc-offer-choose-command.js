const Models = require('../../../models/index');
const Command = require('../command');

/**
 * Chooses bids for particular offer
 */
class DCOfferChooseCommand extends Command {
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
        return this.continueSequence(this.pack(command.data), command.sequence);
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            totalEscrowTime: data.totalEscrowTime.toString(),
            maxTokenAmount: data.maxTokenAmount.toString(),
            minStakeAmount: data.minStakeAmount.toString(),
            importSizeInBytes: data.importSizeInBytes.toString(),
        });
        return data;
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { offerId } = command.data;
        const offer = await Models.offers.findOne({ where: { id: offerId } });
        this.logger.warn(`Failed call choose bids for offer ID ${offer.id}, import ID ${offer.import_id}. ${err}`);
    }

    /**
     * Builds default DcOfferChooseCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferChooseCommand',
            delay: 30000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferChooseCommand;
