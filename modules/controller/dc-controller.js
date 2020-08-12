const utilities = require('../Utilities');
const Models = require('../../models');
const Utilities = require('../Utilities');
const constants = require('../constants');
const { QueryTypes } = require('sequelize');
const BN = require('bn.js');

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

    async updatePermissionedDataPrice(req, res) {
        this.logger.api('POST: Set permissioned data price.');
        if (req.body == null
            || req.body.data_set_id == null
            || req.body.ot_object_ids == null) {
            res.status(400);
            res.send({ message: 'Params data_set_id and ot_object_ids are required.' });
            return;
        }

        const promises = [];
        req.body.ot_object_ids.forEach((ot_object) => {
            promises.push(new Promise(async (accept, reject) => {
                const condition = {
                    seller_erc_id: this.config.erc725Identity.toLowerCase(),
                    data_set_id: req.body.data_set_id.toLowerCase(),
                    ot_json_object_id: ot_object.id,
                };

                const data = await Models.data_sellers.findOne({
                    where: condition,
                });

                if (data) {
                    await Models.data_sellers.update(
                        { price: ot_object.price_in_trac },
                        { where: { id: data.id } },
                    );
                    accept();
                } else {
                    reject();
                }
            }));
        });
        await Promise.all(promises).then(() => {
            res.status(200);
            res.send({ status: 'COMPLETED' });
        });
    }

    async handlePermissionedDataReadRequest(message) {
        const {
            data_set_id, dv_erc725_identity, ot_object_id, handler_id, nodeId,
        } = message;

        const privateDataPermissions = await Models.data_trades.findAll({
            where: {
                data_set_id,
                ot_json_object_id: ot_object_id,
                buyer_node_id: nodeId,
                status: 'COMPLETED',
            },
        });
        if (!privateDataPermissions || privateDataPermissions.length === 0) {
            throw Error(`You don't have permission to view objectId:
            ${ot_object_id} from dataset: ${data_set_id}`);
        }

        const replayMessage = {
            wallet: this.config.node_wallet,
            handler_id,
        };
        const promises = [];
        privateDataPermissions.forEach((privateDataPermisssion) => {
            promises.push(this.graphStorage.findDocumentsByImportIdAndOtObjectId(
                data_set_id,
                privateDataPermisssion.ot_json_object_id,
            ));
        });
        const otObjects = await Promise.all(promises);
        replayMessage.ot_objects = otObjects;

        const normalized_dv_erc725_identity = Utilities.normalizeHex(dv_erc725_identity);

        privateDataPermissions.forEach(async (privateDataPermisssion) => {
            await Models.data_sellers.create({
                data_set_id,
                ot_json_object_id: privateDataPermisssion.ot_json_object_id,
                seller_node_id: nodeId.toLowerCase(),
                seller_erc_id: normalized_dv_erc725_identity,
                price: 0,
            });
        });

        const privateDataReadResponseObject = {
            message: replayMessage,
            messageSignature: Utilities.generateRsvSignature(
                JSON.stringify(replayMessage),
                this.web3,
                this.config.node_private_key,
            ),
        };
        await this.transport.sendPermissionedDataReadResponse(
            privateDataReadResponseObject,
            nodeId,
        );
    }

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

    async getPermissionedDataOwned(req, res) {
        this.logger.api('GET: Permissioned Data Owned.');

        const query = 'SELECT ds.data_set_id, ds.ot_json_object_id, ds.price, ( SELECT Count(*) FROM data_trades dt Where dt.seller_erc_id = ds.seller_erc_id and ds.data_set_id = dt.data_set_id and ds.ot_json_object_id = dt.ot_json_object_id ) as sales FROM  data_sellers ds where ds.seller_erc_id = :seller_erc ';
        const data = await Models.sequelize.query(
            query,
            {
                replacements: { seller_erc: Utilities.normalizeHex(this.config.erc725Identity) },
                type: QueryTypes.SELECT,
            },
        );

        const result = [];

        if (data.length > 0) {
            const owned_objects = {};
            const allDatasets = [];
            /*
               Creating a map of the following structure
               owned_objects: {
                    dataset_0x456: {
                        ot_objects: [ot_object_0x789, ...]
                        ...,
                    },
                    ...
               }
             */
            data.forEach((obj) => {
                if (owned_objects[obj.data_set_id]) {
                    owned_objects[obj.data_set_id].ot_objects.push({
                        id: obj.ot_json_object_id,
                        price: obj.price,
                        sales: obj.sales,
                    });
                    owned_objects[obj.data_set_id].total_sales.iadd(new BN(obj.sales, 10));
                    owned_objects[obj.data_set_id].total_price.iadd(new BN(obj.price, 10));
                } else {
                    allDatasets.push(obj.data_set_id);
                    owned_objects[obj.data_set_id] = {};
                    owned_objects[obj.data_set_id].ot_objects = [{
                        id: obj.ot_json_object_id,
                        price: obj.price,
                        sales: obj.sales,
                    }];
                    owned_objects[obj.data_set_id].total_sales = new BN(obj.sales, 10);
                    owned_objects[obj.data_set_id].total_price = new BN(obj.price, 10);
                }
            });

            const allMetadata = await this.importService.getMultipleDatasetMetadata(allDatasets);

            const dataInfos = await Models.data_info.findAll({
                where: {
                    data_set_id: {
                        [Models.sequelize.Op.in]: allDatasets,
                    },
                },
            });

            allDatasets.forEach((datasetId) => {
                const { datasetHeader } = allMetadata.find(metadata => metadata._key === datasetId);
                const dataInfo = dataInfos.find(info => info.data_set_id === datasetId);
                owned_objects[datasetId].metadata = {
                    datasetTitle: datasetHeader.datasetTitle,
                    datasetTags: datasetHeader.datasetTags,
                    datasetDescription: datasetHeader.datasetDescription,
                    timestamp: dataInfo.import_timestamp,
                };
            });

            for (const dataset in owned_objects) {
                result.push({
                    timestamp: (new Date(owned_objects[dataset].metadata.timestamp)).getTime(),
                    dataset: {
                        id: dataset,
                        name: owned_objects[dataset].metadata.datasetTitle,
                        description: owned_objects[dataset].metadata.datasetDescription || 'No description given',
                        tags: owned_objects[dataset].metadata.datasetTags,
                    },
                    ot_objects: owned_objects[dataset].ot_objects,
                    total_sales: owned_objects[dataset].total_sales.toString(),
                    total_price: owned_objects[dataset].total_price.toString(),
                });
            }
        }

        res.status(200);
        res.send(result);
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

