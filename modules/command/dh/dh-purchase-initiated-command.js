const Command = require('../command');
const Models = require('../../../models');

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
        const events = await Models.events.findAll({
            where: {
                event: 'PurchaseInitiated',
                finished: 0,
            },
        });
        if (events && events.length > 0) {
            const {
                data_set_id,
                ot_json_object_id,
                buyer_node_id,
                encoded_object,
            } = command.data;

            const dataTrade = await Models.data_trades.findOne({
                where: {
                    data_set_id,
                    ot_json_object_id,
                    buyer_node_id,
                },
            });

            const event = events.find((e) => {
                const {
                    sellerIdentity, buyerIdentity, encodedDataRootHash,
                    originalDataRootHash, price,
                } = JSON.parse(e.data);
                return sellerIdentity === dataTrade.seller_erc_id &&
                    buyerIdentity === dataTrade.buyer_erc_id &&
                    encodedDataRootHash === encoded_object.encoded_data_root_hash &&
                    originalDataRootHash === encoded_object.private_data_root_hash &&
                    price === dataTrade.price;
            });
            if (event) {
                const { purchaseId } = JSON.parse(event.data);

                await this.blockchain.depositKey(purchaseId, encoded_object.key);

                dataTrade.purchase_id = purchaseId;
                await dataTrade.save({ fields: ['purchase_id'] });

                const commandData = {
                    purchase_id: purchaseId,
                };

                await this.commandExecutor.add({
                    name: 'DhPurchaseTakePaymentCommand',
                    data: commandData,
                });
                return Command.empty();
            }
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
}

module.exports = DhPurchaseInitiatedCommand;
