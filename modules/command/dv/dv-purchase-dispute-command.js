const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');
const constants = require('../../constants');

const { Op } = Models.Sequelize;

/**
 * Handles data location response.
 */
class DvPurchaseDisputeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchain = ctx.blockchain;
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
        this.permissionedDataService = ctx.permissionedDataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        // send dispute purchase to bc
        const {
            handler_id,
            encoded_data,
            key,
            purchase_id,
            permissioned_data_array_length,
            permissioned_data_original_length,
            error_type,
        } = command.data;

        try {
            const purchaseStatus = await this.blockchain.getPurchaseStatus(purchase_id);

            if (purchaseStatus !== '2') {
                throw new Error(`Cannot issue complaint for purchaseId ${purchase_id}. Purchase already completed`);
            }

            this.remoteControl.purchaseStatus('Purchase not confirmed', 'Sending dispute purchase to Blockchain.', true);

            this.logger.important(`Initiating complaint for purchaseId ${purchase_id}`);

            let result;
            if (error_type === constants.PURCHASE_ERROR_TYPE.NODE_ERROR) {
                const {
                    input_index_left,
                    output_index,
                } = command.data;

                const {
                    encodedInputLeft,
                    encodedOutput,
                    proofOfEncodedInputLeft,
                    proofOfEncodedOutput,
                } = this.permissionedDataService.prepareNodeDisputeData(
                    encoded_data,
                    input_index_left,
                    output_index,
                );

                result = await this.blockchain.complainAboutNode(
                    Utilities.normalizeHex(purchase_id),
                    output_index,
                    input_index_left,
                    Utilities.normalizeHex(encodedOutput),
                    Utilities.normalizeHex(encodedInputLeft),
                    proofOfEncodedOutput,
                    proofOfEncodedInputLeft,
                    true,
                );
            } else if (error_type === constants.PURCHASE_ERROR_TYPE.ROOT_ERROR) {
                const {
                    rootHashIndex,
                    encodedRootHash,
                    proofOfEncodedRootHash,
                } = this.permissionedDataService.prepareRootDisputeData(encoded_data);

                result = await this.blockchain.complainAboutRoot(
                    Utilities.normalizeHex(purchase_id),
                    Utilities.normalizeHex(encodedRootHash),
                    proofOfEncodedRootHash,
                    rootHashIndex,
                    true,
                );
            }

            if (this.blockchain.numberOfEventsEmitted(result) >= 1) {
                this.logger.important(`Purchase complaint for purchaseId ${purchase_id} approved. Refund received.`);
            } else {
                throw new Error(`Purchase complaint for purchaseId ${purchase_id} rejected.`);
            }
        } catch (error) {
            await this._handleError(purchase_id, error.message);
        }

        return Command.empty();
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

    /**
     * Builds default DvPurchaseDisputeCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPurchaseDisputeCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DvPurchaseDisputeCommand;
