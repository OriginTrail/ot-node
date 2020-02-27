const Command = require('../command');
const Models = require('../../../models');
const ImportUtilities = require('../../ImportUtilities');

/**
 * Handles data location response.
 */
class DvPurchaseInitiateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.remoteControl = ctx.remoteControl;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.importService = ctx.importService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            handler_id, status, message, encoded_data,
            private_data_root_hash, encoded_data_root_hash,
            private_data_array_length, private_data_original_length,
        } = command.data;


        if (status !== 'SUCCESSFUL') {
            this.logger.trace(`Unable to initiate purchase dh returned status: ${status} with message: ${message}`);
            return this._handleError(handler_id, status);
        }
        const {
            data_set_id,
            seller_node_id,
            ot_object_id,
        } = await this._getHandlerData(handler_id);

        if (!(await this._validatePrivateDataRootHash(
            data_set_id,
            ot_object_id, private_data_root_hash,
        ))) {
            return this._handleError(handler_id, 'Unable to initiate purchase private data root hash validation failed');
        }

        const dataTrade = await Models.data_trades.findOne({
            where: {
                data_set_id,
                ot_json_object_id: ot_object_id,
                seller_node_id,
            },
        });
        const result = await this.blockchain.initiatePurchase(
            dataTrade.seller_erc_id, dataTrade.buyer_erc_id,
            dataTrade.price,
            private_data_root_hash, encoded_data_root_hash,
        );

        const { purchaseId } = this.blockchain
            .decodePurchaseInitiatedEventFromTransaction(result);

        dataTrade.purchase_id = purchaseId;
        await dataTrade.save({ fields: ['purchase_id'] });

        if (!purchaseId) {
            return this._handleError(handler_id, 'Unable to initiate purchase to bc');
        }

        const commandData = {
            handler_id,
            encoded_data,
            purchase_id: purchaseId,
            private_data_array_length,
            private_data_original_length,
        };

        await this.commandExecutor.add({
            name: 'dvPurchaseKeyDepositedCommand',
            data: commandData,
        });

        this.remoteControl.purchaseStatus('Purchase initiated', 'Waiting for data seller to confirm your order. This may take a few minutes.');
    }

    /**
     * Builds default DvPurchaseInitiateCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPurchaseInitiateCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }

    async _handleError(handler_id, status) {
        // todo should we add message if status is failed for data_trades
        const handlerData = await this._getHandlerData(handler_id);

        await Models.data_trades.update({
            status: 'FAILED',
        }, {
            where: {
                data_set_id: handlerData.data_set_id,
                seller_node_id: handlerData.seller_node_id,
                ot_json_object_id: handlerData.ot_object_id,
            },
        });

        await Models.handler_ids.update({
            data: JSON.stringify({ message: status }),
            status: 'FAILED',
        }, { where: { handler_id } });

        return Command.empty();
    }

    async _validatePrivateDataRootHash(dataSetId, otObjectId, private_data_root_hash) {
        const privateObject = await this.importService.getPrivateDataObject(dataSetId, otObjectId);
        return private_data_root_hash === privateObject.private_data_hash;
    }

    async _getHandlerData(handler_id) {
        const handler = await Models.handler_ids.findOne({
            where: {
                handler_id,
            },
        });

        return JSON.parse(handler.data);
    }
}

module.exports = DvPurchaseInitiateCommand;
