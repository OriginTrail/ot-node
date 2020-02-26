const Command = require('../command');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DhPurchaseInitiatedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        // todo limit purchase initiated commad repeat
        const events = await Models.events.findAll({
            where: {
                event: 'PurchaseInitiated', // todo check event name
                finished: 0,
            },
        });
        if (events) {
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
                } = JSON.parse(e.data);
                return sellerIdentity === dataTrade.seller_erc_id &&
                    buyerIdentity === dataTrade.buyer_erc_id &&
                    encodedDataRootHash === encoded_object.encoded_data_root_hash;
            });
            if (event) {
                // todo validate root
                // todo validate price
                // todo send deposit key
                const { purchaseId } = JSON.parse(event.data);
                dataTrade.purchase_id = purchaseId;
                await dataTrade.save({ fields: ['purchase_id'] });

                const commandData = {
                    purchase_id: purchaseId,
                };

                await this.commandExecutor.add({
                    name: 'DhPurchaseTakePaymentCommand',
                    data: commandData,
                });
            }
        }
        return Command.repeat();
    }

    /**
     * Builds default DhPurchaseInitiatedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPurchaseInitiatedCommand',
            delay: 5 * 60 * 1000, // 5 min
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhPurchaseInitiatedCommand;
