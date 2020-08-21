const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models');
/**
 * Handles data location response.
 */
class DhPurchaseRequestedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.web3 = ctx.web3;
        this.transport = ctx.transport;
        this.importService = ctx.importService;
        this.permissionedDataService = ctx.permissionedDataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            data_set_id, dv_erc725_identity, handler_id, dv_node_id, ot_json_object_id, price,
        } = command.data;
        this.logger.important(`Purchase request for ot_object ${ot_json_object_id} received from ${dv_node_id}.`);
        const dataTrades = await Models.data_trades.findAll({
            where: {
                buyer_node_id: dv_node_id,
                data_set_id,
                ot_json_object_id,
            },
        });
        const response = {
            handler_id,
            wallet: this.config.node_wallet,
        };

        const sellingData = await Models.data_sellers.findOne({
            where: {
                data_set_id,
                ot_json_object_id,
                seller_node_id: this.config.identity,
            },
        });

        if (dataTrades && dataTrades.length > 0) {
            const dataTrade = dataTrades.find(dataTrade => dataTrade.status !== 'FAILED');
            if (dataTrade) {
                response.message = `Data purchase already completed or in progress! Previous purchase status: ${dataTrade.status}`;
                response.status = 'FAILED';
            }
        }
        if (!sellingData) {
            response.status = 'FAILED';
            response.message = 'I dont have requested data';
        } else if (sellingData.price !== price) {
            response.message = `Can't accept purchase with price: ${price}, my price: ${sellingData.price}`;
            response.status = 'FAILED';
        } else if (sellingData.price === '-1') {
            response.message = 'Data is not for sale at the moment';
            response.status = 'FAILED';
        }

        if (response.status !== 'FAILED') {
            const permissionedObject = await this.importService.getOtObjectById(
                data_set_id,
                ot_json_object_id,
            );

            if (permissionedObject) {
                const encodedObject =
                    await this.permissionedDataService.encodePermissionedData(permissionedObject);
                response.permissioned_data_original_length =
                    encodedObject.permissioned_data_original_length;
                response.permissioned_data_array_length =
                    encodedObject.permissioned_data_array_length;
                response.encoded_data = encodedObject.encoded_data;
                response.permissioned_data_root_hash = encodedObject.permissioned_data_root_hash;
                response.encoded_data_root_hash = encodedObject.encoded_data_root_hash;
                response.message = 'Data purchase request completed!';
                response.status = 'SUCCESSFUL';

                const commandData = {
                    data_set_id,
                    ot_json_object_id,
                    buyer_node_id: dv_node_id,
                    encoded_object: encodedObject,
                };
                await this.commandExecutor.add({
                    name: 'dhPurchaseInitiatedCommand',
                    delay: 60 * 1000,
                    retries: 3,
                    data: commandData,
                });
                await Models.data_trades.create({
                    data_set_id,
                    ot_json_object_id,
                    buyer_node_id: dv_node_id,
                    buyer_erc_id: dv_erc725_identity,
                    seller_node_id: this.config.identity,
                    seller_erc_id: this.config.erc725Identity.toLowerCase(),
                    price,
                    status: 'REQUESTED',
                });
            } else {
                response.message = `Unable to find permissioned data with object id: ${ot_json_object_id} and dataset id: ${data_set_id}`;
                response.status = 'FAILED';
            }
        }

        if (response.status === 'FAILED') {
            this.logger.warn(`Failed to confirm purchase request. ${response.message}`);
        } else {
            this.logger.info(`Purchase confirmed for ot_object ${ot_json_object_id} received from ${dv_node_id}. Sending purchase response.`);
        }
        await this._sendResponseToDv(response, dv_node_id);
        this.logger.info(`Purchase request response sent to ${dv_node_id}.`);
        return Command.empty();
    }

    async _sendResponseToDv(response, dv_node_id) {
        const dataPurchaseResponseObject = {
            message: response,
            messageSignature: Utilities.generateRsvSignature(
                response,
                this.web3,
                this.config.node_private_key,
            ),
        };

        await this.transport.sendDataPurchaseResponse(
            dataPurchaseResponseObject,
            dv_node_id,
        );
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { handler_id, dv_node_id } = command.data;

        const response = {
            handler_id,
            wallet: this.config.node_wallet,
            message: `Failed to process dhPurchaseRequestedCommand, error: ${err}`,
            status: 'FAILED',
        };

        await this._sendResponseToDv(response, dv_node_id);

        return Command.empty();
    }

    /**
     * Builds default DhPurchaseRequestedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPurchaseRequestedCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhPurchaseRequestedCommand;
