const models = require('../../models');
const Utilities = require('../Utilities');

const BATCH_SIZE = 15;

/**
 * Runs all pending payout commands
 */
class M1PayoutAllMigration {
    constructor({
        logger, blockchain, config, profileService,
    }) {
        this.logger = logger;
        this.config = config;
        this.blockchain = blockchain;
        this.profileService = profileService;
    }

    /**
     * Run migration
     */
    async run() {
        /* get all pending payouts */
        let pendingPayOuts = await models.commands.findAll({
            where: {
                status: 'PENDING',
                name: 'dhPayOutCommand',
            },
        });

        if (pendingPayOuts.length === 0) {
            this.logger.warn('No pending payouts.');
            return;
        }

        const offerLimit = 60;
        if (pendingPayOuts.length > offerLimit) {
            const message = `Failed to complete payout for more that ${offerLimit}. Please contact support.`;
            this.logger.error(message);
            throw new Error(message);
        }

        // todo pass blockchain identity
        const erc725Identity = this.profileService.getIdentity();
        while (pendingPayOuts.length > 0) {
            const tempPending = pendingPayOuts.slice(0, BATCH_SIZE);
            pendingPayOuts = pendingPayOuts.slice(BATCH_SIZE);

            const offerIds = tempPending.map(payoutCommand => payoutCommand.data.offerId);
            const commandIds = tempPending.map(payoutCommand => payoutCommand.id);

            let message;
            try {
                // eslint-disable-next-line
                await this.blockchain.payOutMultiple(erc725Identity, offerIds).response;
                for (const offerId of offerIds) {
                    this.logger.warn(`Payout successfully completed for offer ${offerId}.`);
                }

                try {
                    // eslint-disable-next-line
                    await models.commands.update(
                        { status: 'COMPLETED' },
                        {
                            where: {
                                status: 'PENDING',
                                name: 'dhPayOutCommand',
                                id: { [models.Sequelize.Op.in]: commandIds },
                            },
                        },
                    );
                } catch (e) {
                    message = `Failed to set status COMPLETED for payout commands. Possible invalid future payout commands. Offers affected ${offerIds}`;
                    this.logger.warn(message);
                }
            } catch (e) {
                message = `Failed to complete payout for offers [${offerIds}]. Please make sure that you have enough ETH. ${e.message}`;
                this.logger.error(message);
                throw new Error(message);
            }
        }
    }
}

module.exports = M1PayoutAllMigration;
