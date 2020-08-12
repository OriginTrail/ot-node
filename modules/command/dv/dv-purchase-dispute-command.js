const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');
const constants = require('../../constants');

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

        this.remoteControl.purchaseStatus('Purchase not confirmed', 'Sending dispute purchase to Blockchain.', true);

        this.logger.important(`Initiating complaint for purchaseId ${purchase_id}`);

        if (error_type === constants.PURCHASE_ERROR_TYPE.node_error) {
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

            await this.blockchain.complainAboutNode(
                Utilities.normalizeHex(purchase_id),
                output_index,
                input_index_left,
                Utilities.normalizeHex(encodedOutput),
                Utilities.normalizeHex(encodedInputLeft),
                proofOfEncodedOutput,
                proofOfEncodedInputLeft,
            );
        } else if (error_type === constants.PURCHASE_ERROR_TYPE.root_error) {
            const {
                rootHashIndex,
                encodedRootHash,
                proofOfEncodedRootHash,
            } = this.permissionedDataService.prepareRootDisputeData(encoded_data);

            await this.blockchain.complainAboutRoot(
                Utilities.normalizeHex(purchase_id),
                Utilities.normalizeHex(encodedRootHash),
                proofOfEncodedRootHash,
                rootHashIndex,
            );
        }

        this.logger.important(`Completed purchase complaint for purchaseId ${purchase_id}`);
        return Command.empty();
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
