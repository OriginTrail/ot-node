const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');
const constants = require('../../constants');

/**
 * Handles data location response.
 */
class DvPurchaseKeyDepositedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.remoteControl = ctx.remoteControl;
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.graphStorage = ctx.graphStorage;
        this.permissionedDataService = ctx.permissionedDataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            handler_id,
            encoded_data,
            purchase_id,
            permissioned_data_array_length,
            permissioned_data_original_length,
            permissioned_data_root_hash,
        } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'KeyDeposited',
                finished: 0,
            },
        });
        if (events && events.length > 0) {
            const event = events.find((e) => {
                const {
                    purchaseId,
                } = JSON.parse(e.data);
                return purchaseId === purchase_id;
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });
                this.logger.important(`Purchase ${purchase_id} confirmed by seller. Decoding data from submitted key.`);
                this.remoteControl.purchaseStatus('Purchase confirmed', 'Validating and storing data on your local node.');
                const { key } = JSON.parse(event.data);

                const decoded_data = this.permissionedDataService.decodePermissionedData(
                    encoded_data,
                    key,
                );

                const validationResult = this.permissionedDataService.validatePermissionedDataTree(
                    decoded_data,
                    permissioned_data_array_length,
                );

                const rootIsValid = this.permissionedDataService.validatePermissionedDataRoot(
                    decoded_data,
                    permissioned_data_root_hash,
                );

                if (validationResult.error || !rootIsValid) {
                    let errorMessage;

                    if (validationResult.error) {
                        command.data.input_index_left = validationResult.inputIndexLeft;
                        command.data.output_index = validationResult.outputIndex;
                        command.data.error_type = constants.PURCHASE_ERROR_TYPE.NODE_ERROR;
                        errorMessage = 'Detected error in permissioned data merkle tree.';
                    } else if (!rootIsValid) {
                        command.data.error_type = constants.PURCHASE_ERROR_TYPE.ROOT_ERROR;
                        errorMessage = 'Detected error in permissioned data decoded root hash.';
                    }

                    await this._handleError(
                        handler_id,
                        purchase_id,
                        errorMessage,
                    );

                    command.data.key = key;
                    await this.commandExecutor.add({
                        name: 'dvPurchaseDisputeCommand',
                        data: command.data,
                    });
                    return Command.empty();
                }

                const reconstructedPermissionedData = this.permissionedDataService
                    .reconstructPermissionedData(
                        decoded_data,
                        permissioned_data_array_length,
                        permissioned_data_original_length,
                    );

                const handler = await Models.handler_ids.findOne({
                    where: {
                        handler_id,
                    },
                });

                const {
                    data_set_id,
                    ot_object_id,
                } = JSON.parse(handler.data);

                await this.permissionedDataService.updatePermissionedDataInDb(
                    data_set_id,
                    ot_object_id,
                    reconstructedPermissionedData,
                );

                handler.status = 'COMPLETED';
                await handler.save({ fields: ['status'] });

                await Models.data_trades.update(
                    {
                        status: 'COMPLETED',
                    },
                    {
                        where: {
                            purchase_id,
                        },
                    },
                );

                await Models.data_sellers.create({
                    data_set_id,
                    ot_json_object_id: ot_object_id,
                    seller_node_id: this.config.identity,
                    seller_erc_id: Utilities.normalizeHex(this.config.erc725Identity),
                    price: this.config.default_data_price,
                });
                this.logger.important(`Purchase ${purchase_id} completed. Data stored successfully`);
                this.remoteControl.purchaseStatus('Purchase completed', 'You can preview the purchased data in My Purchases page.');
                return Command.empty();
            }
        }
        if (command.retries === 0) {
            await this._handleError(
                handler_id,
                purchase_id,
                'Couldn\'t find KeyDeposited event on blockchain.',
            );
            return Command.empty();
        }
        return Command.retry();
    }

    async recover(command, err) {
        const { handler_id, purchase_id } = command.data;

        await this._handleError(handler_id, purchase_id, err);

        return Command.empty();
    }

    async _handleError(handler_id, purchase_id, errorMessage) {
        this.logger.error(`Error occured in dvPurchaseKeyDepositedCommand. Reason given: ${errorMessage}`);
        await Models.data_trades.update({
            status: 'FAILED',
        }, {
            where: {
                purchase_id,
            },
        });

        await Models.handler_ids.update({
            data: JSON.stringify({ message: errorMessage }),
            status: 'FAILED',
        }, { where: { handler_id } });
    }

    /**
     * Builds default DvPurchaseKeyDepositedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPurchaseKeyDepositedCommand',
            delay: 1 * 60 * 1000, // 5 min todo update to 5 min
            transactional: false,
            retries: 3,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DvPurchaseKeyDepositedCommand;
