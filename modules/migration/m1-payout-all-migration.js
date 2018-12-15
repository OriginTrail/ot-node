const models = require('../../models');
const Models = require('../../models/index');
const Utilities = require('../Utilities');

/**
 * Runs all pending payout commands
 */
class M1PayoutAllMigration {
    constructor({ logger, blockchain }) {
        this.logger = logger;
        this.blockchain = blockchain;
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

        for (const pendingPayOut of pendingPayOuts) {
            const { data } = pendingPayOut;

            let retries = 3;
            while (retries > 0) {
                try {
                    // eslint-disable-next-line
                    await this._payOut(data.offerId);
                    pendingPayOut.status = 'COMPLETED';
                    pendingPayOut.save({
                        fields: ['status'],
                    });
                    break;
                } catch (e) {
                    retries -= 1;
                    if (retries > 0) {
                        this.logger.error(`Failed to run payout migration. Retrying... ${e}`);
                    } else {
                        this.logger.error(`Failed to run payout migration. Stop retrying... ${e}`);
                    }
                }
            }
        }
    }

    async _payOut(offerId) {
        const bid = await Models.bids.findOne({
            where: { offer_id: offerId, status: 'CHOSEN' },
        });
        if (!bid) {
            this.logger.important(`There is no successful bid for offer ${offerId}. Cannot execute payout.`);
            return;
        }
        const blockchainIdentity = Utilities.normalizeHex(this.config.erc725Identity);
        await this.blockchain.payOut(blockchainIdentity, offerId);
        this.logger.important(`Payout for offer ${offerId} successfully completed.`);
    }
}

module.exports = M1PayoutAllMigration;
