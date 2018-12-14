const models = require('../../models');

/**
 * Runs all pending payout commands
 */
class M1PayoutAllMigration {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.payOutHandler = ctx.dhPayOutCommand;
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
            const data = this.payOutHandler.unpack(pendingPayOut.data);

            let retries = 2;
            while (retries > 0) {
                try {
                    // eslint-disable-next-line
                    await this.payOutHandler.execute({ data }); // run payout
                    this.logger.info(`Payout migration for offer ${data.offerId} completed.`);
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

        // complete all pending payouts
        await models.commands.update(
            {
                status: 'COMPLETED',
            },
            {
                where: {
                    status: 'PENDING',
                    name: 'dhPayOutCommand',
                },
            },
        );
    }
}

module.exports = M1PayoutAllMigration;
