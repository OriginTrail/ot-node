const Command = require('../command');
const MerkleTree = require('../../Merkle');
const Models = require('../../../models');

const { Op } = Models.Sequelize;
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
        this.commandExecutor = ctx.commandExecutor;
        this.permissionedDataService = ctx.permissionedDataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            handler_id, status, message, encoded_data,
            permissioned_data_root_hash, encoded_data_root_hash,
            permissioned_data_array_length, permissioned_data_original_length,
        } = command.data;


        if (status !== 'SUCCESSFUL') {
            this.logger.warn(`Unable to initiate purchase, seller returned status: ${status} with message: ${message}`);
            await this._handleError(handler_id, status);
            return Command.empty();
        }
        const {
            data_set_id,
            seller_node_id,
            ot_object_id,
        } = await this._getHandlerData(handler_id);
        this.logger.trace(`Received encoded permissioned data for object ${ot_object_id} from seller ${seller_node_id}. Verifying data integrity...`);

        const permissionedObject = await this.importService.getOtObjectById(
            data_set_id,
            ot_object_id,
        );

        if (permissioned_data_root_hash !==
            permissionedObject.properties.permissioned_data.permissioned_data_hash) {
            await this._handleError(handler_id, 'Unable to initiate purchase. Permissioned data root hash validation failed');
            return Command.empty();
        }

        // Verify data integrity
        // Recreate merkle tree
        const encodedMerkleTree = new MerkleTree(encoded_data, 'purchase', 'soliditySha3');
        const encodedDataRootHash = encodedMerkleTree.getRoot();

        if (encoded_data_root_hash !== encodedDataRootHash) {
            await this._handleError(handler_id, 'Unable to initiate purchase. Encoded data root hash validation failed');
            return Command.empty();
        }

        this.logger.info('Purchase response verified. Initiating purchase on the blockchain...');

        const dataTrade = await Models.data_trades.findOne({
            where: {
                data_set_id,
                ot_json_object_id: ot_object_id,
                seller_node_id,
                status: { [Op.ne]: 'FAILED' },
            },
        });
        const result = await this.blockchain.initiatePurchase(
            dataTrade.seller_erc_id, dataTrade.buyer_erc_id,
            dataTrade.price, permissioned_data_root_hash, encoded_data_root_hash,
        );

        const { purchaseId } = this.blockchain.decodePurchaseInitiatedEventFromTransaction(result);
        this.logger.important(`Purchase ${purchaseId} initiated. Waiting for key from seller...`);

        if (!purchaseId) {
            this.remoteControl.purchaseStatus('Purchase failed', 'Unabled to initiate purchase to Blockchain.', true);
            await this._handleError(handler_id, 'Unable to initiate purchase to bc');
            return Command.empty();
        }

        dataTrade.purchase_id = purchaseId;
        dataTrade.status = 'INITIATED';
        await dataTrade.save({ fields: ['purchase_id', 'status'] });

        const commandData = {
            handler_id,
            encoded_data,
            purchase_id: purchaseId,
            permissioned_data_array_length,
            permissioned_data_original_length,
            permissioned_data_root_hash,
        };

        await this.commandExecutor.add({
            name: 'dvPurchaseKeyDepositedCommand',
            delay: 2 * 60 * 1000,
            retries: 3,
            data: commandData,
        });

        this.remoteControl.purchaseStatus('Purchase initiated', 'Waiting for data seller to confirm your order. This may take a few minutes.');

        return Command.empty();
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

    async recover(command, err) {
        const { handler_id } = command.data;

        await this._handleError(handler_id, `Failed to process dvPurchaseInitiateCommand. Error: ${err}`);

        return Command.empty();
    }

    async _handleError(handler_id, errorMessage) {
        this.logger.error(`Failed to initiate purchase: ${errorMessage}`);
        const handlerData = await this._getHandlerData(handler_id);

        await Models.data_trades.update({
            status: 'FAILED',
        }, {
            where: {
                data_set_id: handlerData.data_set_id,
                seller_node_id: handlerData.seller_node_id,
                ot_json_object_id: handlerData.ot_object_id,
                status: { [Op.ne]: 'FAILED' },
            },
        });

        await Models.handler_ids.update({
            data: JSON.stringify({ message: errorMessage }),
            status: 'FAILED',
        }, { where: { handler_id } });
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
