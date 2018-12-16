const models = require('../../models');
const Utilities = require('../Utilities');

/**
 * Runs all pending payout commands
 */
class M1PayoutAllMigration {
    constructor({
        logger, blockchain, config, notifyError,
    }) {
        this.logger = logger;
        this.config = config;
        this.blockchain = blockchain;
        this.notifyError = notifyError;
    }

    /**
     * Run migration
     */
    async run() {
        /* get all pending payouts */
        const pendingPayOuts = await models.commands.findAll({
            where: {
                status: 'PENDING',
                name: 'dhPayOutCommand',
            },
        });

        const offerIds = pendingPayOuts.map(payoutCommand => payoutCommand.data.offerId);

        if (offerIds.length === 0) {
            this.logger.trace('No pending offers.');
            return;
        }

        const offerLimit = 60;
        if (offerIds.length > offerLimit) {
            const message = `Failed to complete payout for more that ${offerLimit}. Please contact support.`;
            this.logger.error(message);
            throw new Error(message);
        }

        const erc725Identity = Utilities.normalizeHex(this.config.erc725Identity);

        let message;
        try {
            await this.blockchain.payOutMultiple(erc725Identity, offerIds);
            this.logger.warn(`Payout successfully completed for ${offerIds.length} offer(s).`);
        } catch (e) {
            message = `Failed to complete payout for offers [${offerIds}]. Please make sure that you have enough ETH. ${e.message}`;
            this.logger.error(message);
            throw new Error(message);
        }

        try {
            await models.commands.update(
                { status: 'COMPLETED' },
                { where: { status: 'PENDING', name: 'dhPayOutCommand' } },
            );
        } catch (e) {
            message = `Failed to set status COMPLETED for payout commands. Possible invalid future payout commands. Offers affected ${offerIds}`;
            this.logger.warn(message);
            this.notifyError(new Error(message));
        }
    }
}

module.exports = M1PayoutAllMigration;
