const utilities = require('../Utilities');
const Models = require('../../models');
const Utilities = require('../Utilities');
const constants = require('../constants');

/**
 * DC related API controller
 */
class DCController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.emitter = ctx.emitter;
        this.apiUtilities = ctx.apiUtilities;
        this.config = ctx.config;
        this.dcService = ctx.dcService;
        this.remoteControl = ctx.remoteControl;
        this.graphStorage = ctx.graphStorage;
        this.transport = ctx.transport;
        this.importService = ctx.importService;
        this.web3 = ctx.web3;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Validate create offer request and import
     *
     * @param req   HTTP request
     * @param res   HTTP response
     */
    async handleReplicateRequest(req, res) {
        if (req.body !== undefined && req.body.dataset_id !== undefined && typeof req.body.dataset_id === 'string' &&
            utilities.validateNumberParameter(req.body.holding_time_in_minutes) &&
            utilities.validateStringParameter(req.body.token_amount_per_holder) &&
            utilities.validateNumberParameter(req.body.litigation_interval_in_minutes)) {
            var handlerId = null;
            var offerId = '';
            try {
                const dataset = await Models.data_info.findOne({
                    where: { data_set_id: req.body.dataset_id },
                });
                if (dataset == null) {
                    this.logger.info('Invalid request');
                    res.status(400);
                    res.send({
                        message: 'This data set does not exist in the database',
                    });
                    return;
                }

                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',

                });
                handlerId = inserted_object.dataValues.handler_id;
                offerId = await this.dcService.createOffer(
                    req.body.dataset_id, dataset.root_hash, req.body.holding_time_in_minutes,
                    req.body.token_amount_per_holder, dataset.otjson_size_in_bytes,
                    req.body.litigation_interval_in_minutes, handlerId,
                    req.body.urgent,
                );
                const handler_data = {
                    status: 'PUBLISHING_TO_BLOCKCHAIN',
                    offer_id: offerId,
                };
                await Models.handler_ids.update({
                    data: JSON.stringify(handler_data),
                }, {
                    where: {
                        handler_id: handlerId,
                    },
                });
                res.status(200);
                res.send({
                    handler_id: handlerId,
                });
            } catch (error) {
                this.logger.error(`Failed to create offer. ${error}.`);

                this.errorNotificationService.notifyError(
                    error,
                    {
                        offerId,
                        tokenAmountPerHolder: req.body.token_amount_per_holder,
                        datasetId: req.body.dataset_id,
                        holdingTimeInMinutes: req.body.holding_time_in_minutes,
                    },
                    constants.PROCESS_NAME.offerHandling,
                );

                if (handlerId) {
                    Models.handler_ids.update({
                        status: 'FAILED',
                    }, { where: { handler_id: handlerId } });
                }
                res.status(400);
                res.send({
                    message: `Failed to start offer. ${error}.`,
                });
                this.remoteControl.failedToCreateOffer(`Failed to start offer. ${error}.`);
            }
        } else {
            this.logger.error('Invalid request');
            res.status(400);
            res.send({
                message: 'Invalid parameters!',
            });
        }
    }

    // async handlePrivateDataReadRequest(message) {
    //     const {
    //         data_set_id, dv_erc725_identity, ot_object_id, handler_id, nodeId,
    //     } = message;
    //
    //     const privateDataPermissions = await Models.data_trades.findAll({
    //         where: {
    //             data_set_id,
    //             ot_json_object_id: ot_object_id,
    //             buyer_node_id: nodeId,
    //             status: 'COMPLETED',
    //         },
    //     });
    //     if (!privateDataPermissions || privateDataPermissions.length === 0) {
    //         throw Error(`You don't have permission to view objectId:
    //         ${ot_object_id} from dataset: ${data_set_id}`);
    //     }
    //
    //     const replayMessage = {
    //         wallet: this.config.node_wallet,
    //         handler_id,
    //     };
    //     const promises = [];
    //     privateDataPermissions.forEach((privateDataPermisssion) => {
    //         promises.push(this.graphStorage.findDocumentsByImportIdAndOtObjectId(
    //             data_set_id,
    //             privateDataPermisssion.ot_json_object_id,
    //         ));
    //     });
    //     const otObjects = await Promise.all(promises);
    //     replayMessage.ot_objects = otObjects;
    //
    //     privateDataPermissions.forEach(async (privateDataPermisssion) => {
    //         await Models.data_sellers.create({
    //             data_set_id,
    //             ot_json_object_id: privateDataPermisssion.ot_json_object_id,
    //             seller_node_id: nodeId.toLowerCase(),
    //             seller_erc_id: Utilities.normalizeHex(dv_erc725_identity),
    //             price: 0,
    //         });
    //     });
    //
    //     const privateDataReadResponseObject = {
    //         message: replayMessage,
    //         messageSignature: Utilities.generateRsvSignature(
    //             JSON.stringify(replayMessage),
    //             this.web3,
    //             this.config.node_private_key,
    //         ),
    //     };
    //     await this.transport.sendPrivateDataReadResponse(
    //         privateDataReadResponseObject,
    //         nodeId,
    //     );
    // }
    // async handleNetworkPurchaseRequest(request) {
    //     const {
    //         data_set_id, dv_erc725_identity, handler_id, dv_node_id, ot_json_object_id,
    //     } = request;
    //
    //     const permission = await Models.data_trades.findOne({
    //         where: {
    //             buyer_node_id: dv_node_id,
    //             data_set_id,
    //             ot_json_object_id,
    //             status: 'COMPLETED',
    //         },
    //     });
    //     let message = '';
    //     let status = '';
    //     const sellingData = await Models.data_sellers.findOne({
    //         where: {
    //             data_set_id,
    //             ot_json_object_id,
    //             seller_node_id: this.config.identity,
    //         },
    //     });
    //
    //     if (permission) {
    //         message = 'Data already purchased!';
    //         status = 'COMPLETED';
    //     } else if (!sellingData) {
    //         status = 'FAILED';
    //         message = 'I dont have requested data';
    //     } else {
    //         await Models.data_trades.create({
    //             data_set_id,
    //             ot_json_object_id,
    //             buyer_node_id: dv_node_id,
    //             buyer_erc_id: dv_erc725_identity,
    //             seller_node_id: this.config.identity,
    //             seller_erc_id: this.config.erc725Identity.toLowerCase(),
    //             price: sellingData.price,
    //             purchase_id: '',
    //             status: 'COMPLETED',
    //         });
    //         message = 'Data purchase successfully finalized!';
    //         status = 'COMPLETED';
    //     }
    //
    //
    //     const response = {
    //         handler_id,
    //         status,
    //         wallet: this.config.node_wallet,
    //         message,
    //         price: sellingData.price,
    //         seller_node_id: this.config.identity,
    //         seller_erc_id: this.config.erc725Identity,
    //     };
    //
    //     const dataPurchaseResponseObject = {
    //         message: response,
    //         messageSignature: Utilities.generateRsvSignature(
    //             JSON.stringify(response),
    //             this.web3,
    //             this.config.node_private_key,
    //         ),
    //     };
    //
    //     await this.transport.sendDataPurchaseResponse(
    //         dataPurchaseResponseObject,
    //         dv_node_id,
    //     );
    // }
    async handleNetworkPurchaseRequest(request) {
        const {
            data_set_id, dv_erc725_identity, handler_id, dv_node_id, ot_json_object_id, price,
        } = request;

        // todo validate data in request

        const commandData = {
            data_set_id,
            dv_erc725_identity,
            handler_id,
            dv_node_id,
            ot_json_object_id,
            price,
        };

        await this.commandExecutor.add({
            name: 'dhPurchaseRequestedCommand',
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }

    async handleNetworkPriceRequest(request) {
        const {
            data_set_id, handler_id, dv_node_id, ot_json_object_id,
        } = request;

        const condition = {
            where: {
                seller_erc_id: this.config.erc725Identity.toLowerCase(),
                data_set_id,
                ot_json_object_id,
            },
        };
        let response;
        const data = await Models.data_sellers.findOne(condition);
        if (data) {
            response = {
                handler_id,
                status: 'COMPLETED',
                wallet: this.config.node_wallet,
                price_in_trac: data.price,
            };
        } else {
            response = {
                handler_id,
                status: 'FAILED',
                wallet: this.config.node_wallet,
            };
        }


        const dataPriceResponseObject = {
            message: response,
            messageSignature: Utilities.generateRsvSignature(
                response,
                this.web3,
                this.config.node_private_key,
            ),
        };

        await this.transport.sendPermissionedDataPriceResponse(
            dataPriceResponseObject,
            dv_node_id,
        );
    }
}

module.exports = DCController;

