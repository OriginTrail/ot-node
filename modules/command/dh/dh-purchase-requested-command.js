const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models');

const { Op } = Models.Sequelize;

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
        this.transport = ctx.transport;
        this.importService = ctx.importService;
        this.permissionedDataService = ctx.permissionedDataService;
        this.profileService = ctx.profileService;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            data_set_id, dv_erc725_identity, handler_id, dv_node_id, ot_json_object_id,
            price, blockchain_id,
        } = command.data;
        this.logger.important(`Purchase request for ot_object ${ot_json_object_id} received from ${dv_node_id}.`);
        const { node_wallet, node_private_key } = this.blockchain.getWallet(blockchain_id).response;

        const response = {
            handler_id,
            wallet: node_wallet,
        };

        const sellingData = await Models.data_sellers.findOne({
            where: {
                data_set_id,
                ot_json_object_id,
                blockchain_id,
                seller_node_id: this.config.identity,
            },
        });

        const existingDataTrade = await Models.data_trades.findOne({
            where: {
                buyer_node_id: dv_node_id,
                data_set_id,
                ot_json_object_id,
                status: { [Op.ne]: 'FAILED' },
            },
        });
        if (existingDataTrade) {
            response.status = 'FAILED';
            response.message = `Data purchase already completed or in progress! Previous purchase status: ${existingDataTrade.status}`;
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

                response.status = 'SUCCESSFUL';
                response.message = 'Data purchase request completed!';

                response.encoded_data = encodedObject.encoded_data;

                response.permissioned_data_root_hash = encodedObject.permissioned_data_root_hash;
                response.encoded_data_root_hash = encodedObject.encoded_data_root_hash;

                response.permissioned_data_array_length =
                    encodedObject.permissioned_data_array_length;
                response.permissioned_data_original_length =
                    encodedObject.permissioned_data_original_length;

                response.blockchain_id = blockchain_id;

                await Models.data_trades.create({
                    data_set_id,
                    ot_json_object_id,
                    blockchain_id,
                    buyer_node_id: dv_node_id,
                    buyer_erc_id: dv_erc725_identity,
                    seller_node_id: this.config.identity,
                    seller_erc_id: this.profileService.getIdentity(blockchain_id).toLowerCase(),
                    price,
                    status: 'REQUESTED',
                });

                const commandData = {
                    data_set_id,
                    ot_json_object_id,
                    blockchain_id,
                    buyer_node_id: dv_node_id,
                    encoded_object: encodedObject,
                };
                await this.commandExecutor.add({
                    name: 'dhPurchaseInitiatedCommand',
                    delay: 60 * 1000,
                    retries: 3,
                    data: commandData,
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
        await this._sendResponseToDv(response, dv_node_id, node_private_key);
        this.logger.info(`Purchase request response sent to ${dv_node_id}.`);
        return Command.empty();
    }

    async _sendResponseToDv(response, dv_node_id, node_private_key) {
        const dataPurchaseResponseObject = {
            message: response,
            messageSignature: Utilities.generateRsvSignature(
                response,
                node_private_key,
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

        const { node_wallet, node_private_key } = this.blockchain.getWallet().response;

        const response = {
            handler_id,
            wallet: node_wallet,
            message: `Failed to process dhPurchaseRequestedCommand, error: ${err}`,
            status: 'FAILED',
        };

        await this._sendResponseToDv(response, dv_node_id, node_private_key);

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
