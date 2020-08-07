const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');

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
                this.logger.important(`Purchase ${purchase_id} verified. Decoding data from given key`);
                this.remoteControl.purchaseStatus('Purchase confirmed', 'Validating and storing data on your local node.');
                const { key } = JSON.parse(event.data);
                const decodedPermissionedData = this.permissionedDataService
                    .validateAndDecodePermissionedData(
                        encoded_data, key, permissioned_data_array_length,
                        permissioned_data_original_length,
                    );
                if (decodedPermissionedData.errorStatus) {
                    await this._handleError(
                        handler_id,
                        purchase_id,
                        'Couldn\'t verify data with given key.',
                    );

                    const commandData = {
                        encoded_data,
                    };
                    await this.commandExecutor.add({
                        name: 'dvPurchaseDisputeCommand',
                        data: commandData,
                    });
                    return Command.empty();
                }

                const handler = await Models.handler_ids.findOne({
                    where: {
                        handler_id,
                    },
                });

                handler.status = 'COMPLETED';
                await handler.save({ fields: ['status'] });

                const {
                    data_set_id,
                    ot_object_id,
                } = JSON.parse(handler.data);

                await this.permissionedDataService.updatePermissionedDataInDb(
                    data_set_id,
                    ot_object_id,
                    decodedPermissionedData.permissionedData,
                );

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

        await this._handleError(handler_id, purchase_id, `Failed to process dvPurchaseKeyDepositedCommand. Error: ${err}`);

        return Command.empty();
    }

    async _handleError(handler_id, purchase_id, errorMessage) {
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
