const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');

const { Op } = Models.Sequelize;
/**
 * Handles data location response.
 */
class DhPurchaseInitiatedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            data_set_id,
            ot_json_object_id,
            buyer_node_id,
            encoded_object,
        } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'PurchaseInitiated',
                finished: 0,
            },
        });
        if (events && events.length > 0) {
            const dataTrade = await Models.data_trades.findOne({
                where: {
                    data_set_id,
                    ot_json_object_id,
                    buyer_node_id,
                    status: { [Op.ne]: 'FAILED' },
                },
            });
            const event = events.find((e) => {
                const {
                    sellerIdentity, buyerIdentity, encodedDataRootHash,
                    originalDataRootHash, price,
                } = JSON.parse(e.data);
                return Utilities.normalizeHex(sellerIdentity) === dataTrade.seller_erc_id &&
                    Utilities.normalizeHex(buyerIdentity)
                    === Utilities.normalizeHex(dataTrade.buyer_erc_id) &&
                    Utilities.normalizeHex(encodedDataRootHash)
                    === encoded_object.encoded_data_root_hash &&
                    Utilities.normalizeHex(originalDataRootHash)
                    === encoded_object.permissioned_data_root_hash &&
                    price === dataTrade.price;
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                const { purchaseId } = JSON.parse(event.data);
                this.logger.important(`Purchase ${purchaseId} initiated`);

                await this.blockchain.depositKey(purchaseId, encoded_object.key);

                dataTrade.purchase_id = Utilities.normalizeHex(purchaseId);
                await dataTrade.save({ fields: ['purchase_id'] });

                const commandData = {
                    purchase_id: purchaseId,
                };

                let delay = await this.blockchain.getPaymentStageInterval();
                delay = parseInt(delay, 10) * 1000;

                this.logger.info(`Key deposited for purchaseID ${purchaseId}.`
                    + ' Waiting for complaint window to expire before taking payment.');
                await this.commandExecutor.add({
                    name: 'dhPurchaseTakePaymentCommand',
                    data: commandData,
                    delay,
                    retries: 3,
                });
                return Command.empty();
            }
        }
        if (command.retries === 0) {
            await this._handleError(
                data_set_id,
                ot_json_object_id,
                buyer_node_id, 'Couldn\'t find PurchaseInitiated event on blockchain.',
            );
            return Command.empty();
        }
        return Command.retry();
    }

    /**
     * Builds default DhPurchaseInitiatedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPurchaseInitiatedCommand',
            delay: 1 * 60 * 1000, // 5 min todo update to 5 min
            transactional: false,
            retries: 3,
        };
        Object.assign(command, map);
        return command;
    }

    async recover(command, err) {
        const {
            data_set_id,
            ot_json_object_id,
            buyer_node_id,
        } = command.data;

        await this._handleError(
            data_set_id,
            ot_json_object_id,
            buyer_node_id, `Failed to process dhPurchaseInitiatedCommand. Error: ${err}`,
        );

        return Command.empty();
    }

    async _handleError(
        data_set_id,
        ot_json_object_id,
        buyer_node_id,
        errorMessage,
    ) {
        this.logger.error(errorMessage);
        await Models.data_trades.update(
            {
                status: 'FAILED',
            },
            {
                where: {
                    data_set_id,
                    ot_json_object_id,
                    buyer_node_id,
                    status: { [Op.ne]: 'FAILED' },
                },
            },
        );
    }
}

module.exports = DhPurchaseInitiatedCommand;
