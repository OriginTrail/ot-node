const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models');
const constants = require('../../constants');
/**
 * Handles data location response.
 */
class DhPurchaseRequestedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
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

        const permission = await Models.data_trades.findOne({
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

        if (permission) {
            response.message = `Data purchase already completed or in progress! Previous purchase status: ${permission.status}`;
            response.status = 'FAILED';
        } else if (!sellingData) {
            response.status = 'FAILED';
            response.message = 'I dont have requested data';
        } else if (sellingData.price !== price) {
            response.message = `Can't accept purchase with price: ${price}, my price: ${sellingData.price}`;
            response.status = 'FAILED';
        } else {
            const privateObject = await this._getPrivateObject(data_set_id, ot_json_object_id);
            if (privateObject) {
                const encodedObject = await this._encodePrivateData(privateObject);
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
                response.encoded_data = encodedObject.encoded_data;
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
                    delay: 5 * 60 * 1000, // 5 min
                    data: commandData,
                    transactional: false,
                });
            } else {
                response.message = `Unable to find private data with object id: ${ot_json_object_id} and dataset id: ${data_set_id}`;
                response.status = 'FAILED';
            }
        }

        const dataPurchaseResponseObject = {
            message: response,
            messageSignature: Utilities.generateRsvSignature(
                JSON.stringify(response),
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

    async _getPrivateObject(data_set_id, ot_json_object_id) {
        const privateDataObject = await this.graphStorage.findDocumentsByImportIdAndOtObjectId(
            data_set_id,
            ot_json_object_id,
        );

        const privateObjectArray = [];
        constants.PRIVATE_DATA_OBJECT_NAMES.forEach((private_data_array) => {
            if (privateDataObject.properties[private_data_array] &&
                Array.isArray(privateDataObject.properties[private_data_array])) {
                privateDataObject.properties[private_data_array].forEach((private_object) => {
                    if (private_object.isPrivate) {
                        privateObjectArray.push(private_object);
                    }
                });
            }
        });

        if (privateObjectArray.length > 1) {
            this.logger.trace(`Found multiple private data in object with id: ${ot_json_object_id}, using first one`);
        }
        if (privateObjectArray.length === 1) {
            return privateObjectArray[0];
        }
        return null;
    }

    async _encodePrivateData(privateObject) {
        const key = '123';
        return {
            key,
            encoded_data: privateObject.data,
            private_data_hash: privateObject.private_data_hash,
        };
    }
}

module.exports = DhPurchaseRequestedCommand;
