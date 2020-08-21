const Command = require('../command');
const Models = require('../../../models');

const { Op } = Models.Sequelize;

/**
 * Handles data location response.
 */
class DhPurchaseTakePaymentCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const { purchase_id } = command.data;
        const dataTrade = await Models.data_trades.findOne({
            where: {
                purchase_id,
            },
        });
        const bcPurchase = await this.blockchain.getPurchase(purchase_id);
        if (bcPurchase.stage === '2') {
            try {
                await this.blockchain.takePayment(purchase_id);
                dataTrade.status = 'COMPLETED';
                await dataTrade.save({ fields: ['status'] });
                await Models.data_sellers.create({
                    data_set_id: dataTrade.data_set_id,
                    ot_json_object_id: dataTrade.ot_json_object_id,
                    seller_node_id: dataTrade.seller_node_id,
                    seller_erc_id: dataTrade.seller_erc_id,
                    price: dataTrade.price,
                });
                this.logger.info(`Payment has been taken for purchase ${purchase_id}`);
            } catch (error) {
                if (error.message.includes('Complaint window has not yet expired!')) {
                    if (command.retries !== 0) {
                        return Command.retry();
                    }
                }
                this.logger.error(error.message);
                dataTrade.status = 'FAILED';
                await dataTrade.save({ fields: ['status'] });

                await this._handleError(
                    purchase_id,
                    `Couldn't execute takePayment command. Error: ${error.message}`,
                );
            }
        } else {
            dataTrade.status = 'DISPUTED';
            await dataTrade.save({ fields: ['status'] });

            await this._handleError(
                purchase_id,
                `Couldn't execute takePayment command for purchase with purchaseId ${purchase_id}. Error: Data mismatch proven in dispute`,
            );
        }

        return Command.empty();
    }

    /**
     * Builds default DhPurchaseTakePaymentCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPurchaseTakePaymentCommand',
            delay: 5 * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }

    async _handleError(
        purchase_id,
        errorMessage,
    ) {
        this.logger.error(errorMessage);
        await Models.data_trades.update(
            {
                status: 'FAILED',
            },
            {
                where: {
                    purchase_id,
                    status: { [Op.ne]: 'FAILED' },
                },
            },
        );
    }
}

module.exports = DhPurchaseTakePaymentCommand;
