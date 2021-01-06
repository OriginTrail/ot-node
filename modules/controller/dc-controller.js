const utilities = require('../Utilities');
const Models = require('../../models');
const Utilities = require('../Utilities');
const constants = require('../constants');
const { QueryTypes } = require('sequelize');
const BN = require('bn.js');
const ObjectValidator = require('../validator/object-validator');

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
        this.documentStorage = ctx.documentStorage;
        this.transport = ctx.transport;
        this.importService = ctx.importService;
        this.web3 = ctx.web3;
        this.commandExecutor = ctx.commandExecutor;
        this.permissionedDataService = ctx.permissionedDataService;

        this.stanards = ['OT-JSON', 'GS1-EPCIS', 'GRAPH', 'WOT'];

        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('ot-json', 'ot-json');
        this.mapping_standards_for_event.set('gs1-epcis', 'gs1');
        this.mapping_standards_for_event.set('graph', 'ot-json');
        this.mapping_standards_for_event.set('wot', 'wot');
    }

    async importDataset(req, res) {
        this.logger.api('POST: Import of data request received.');

        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        // Check if import type is valid
        if (req.body.standard_id === undefined ||
            this.stanards.indexOf(req.body.standard_id) === -1) {
            res.status(400);
            res.send({
                message: 'Invalid import type',
            });
            return;
        }

        const standard_id =
            this.mapping_standards_for_event.get(req.body.standard_id.toLowerCase());

        let fileContent;
        if (req.files !== undefined && req.files.file !== undefined) {
            const inputFile = req.files.file.path;
            fileContent = await Utilities.fileContents(inputFile);
        } else if (req.body.file !== undefined) {
            fileContent = req.body.file;
        }

        if (fileContent) {
            try {
                const handler_id = await this.importService.importDataset(fileContent, standard_id);
                res.status(200);
                res.send({
                    handler_id,
                });
            } catch (e) {
                res.status(400);
                res.send({
                    message: 'No import data provided',
                });
            }
        } else {
            res.status(400);
            res.send({
                message: 'No import data provided',
            });
        }
    }

    /**
     * Get all supported standards
     * @param req
     * @param res
     * @private
     */
    getStandards(req, res) {
        const msg = [];
        this.stanards.forEach(standard =>
            msg.push(standard));
        res.send({
            message: msg,
        });
    }
    /**
     * Validate create offer request and import
     *
     * @param req   HTTP request
     * @param res   HTTP response
     */
    async handleReplicateRequest(req, res) {
        this.logger.api('POST: Replicate request received.');
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
                    status: 'INITIALIZED',

                });
                handlerId = inserted_object.dataValues.handler_id;

                res.status(200);
                res.send({
                    handler_id: handlerId,
                });
                const commandData = {
                    dataSetId: req.body.dataset_id,
                    dataRootHash: dataset.root_hash,
                    holdingTimeInMinutes: req.body.holding_time_in_minutes,
                    tokenAmountPerHolder: req.body.token_amount_per_holder,
                    dataSizeInBytes: dataset.otjson_size_in_bytes,
                    litigationIntervalInMinutes: req.body.litigation_interval_in_minutes,
                    handler_id: handlerId,
                    urgent: req.body.urgent,
                };
                const commandSequence = [
                    'dcOfferPrepareCommand',
                    'dcOfferCreateDbCommand',
                    'dcOfferCreateBcCommand',
                    'dcOfferTaskCommand',
                    'dcOfferChooseCommand'];

                await this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: commandData,
                    transactional: false,
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


    async removePermissionedData(req, res) {
        this.logger.api('POST: Remove permissioned data request received.');
        if (req.body === undefined ||
            req.body.dataset_id === undefined ||
            req.body.identifier_value === undefined ||
            req.body.identifier_type === undefined
        ) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        const { dataset_id, identifier_value, identifier_type } = req.body;

        let status = await this.permissionedDataService.removePermissionedDataInDb(
            dataset_id,
            Utilities.keyFrom(identifier_type, identifier_value),
        );

        await Models.data_sellers.destroy({
            where: {
                data_set_id: dataset_id,
                seller_erc_id: this.config.erc725Identity,
                ot_json_object_id: identifier_value,
            },
        });

        let message;
        if (status) {
            status = 'COMPLETED';
            message = 'Permissioned data successfully removed';
        } else {
            status = 'FAILED';
            message = 'Permissioned data doesn\'t exist';
        }
        res.status(200);
        res.send({ status, message });
    }

    /**
     * Query local data
     * @param query Query
     * @returns {Promise<*>}
     */
    async queryLocal(req, res) {
        this.logger.api('POST: Query local request received.');
        if (!req.body) {
            res.status(400);
            res.send({
                message: 'Body is missing',
            });
            return;
        }

        const { query } = req.body;

        this.logger.info(`Local query handling triggered with ${JSON.stringify(query)}.`);
        const validationError = ObjectValidator.validateSearchQueryObject(query);
        if (validationError) {
            throw validationError;
        }

        const { path, value } = query[0];
        const valuesArray = Utilities.arrayze(value);

        const keys = [];

        for (let i = 0; i < valuesArray.length; i += 1) {
            keys.push(Utilities.keyFrom(path, valuesArray[i]));
        }

        const result = await this.graphStorage.findLocalQuery({
            identifierKeys: keys,
        });
        const response = this.importService.packLocalQueryData(result);
        for (let i = 0; i < response.length; i += 1) {
            let offer_id = null;

            // eslint-disable-next-line no-await-in-loop
            const offer = await Models.offers.findOne({
                where: { data_set_id: response[i].datasets[0], status: { [Models.Sequelize.Op.not]: 'FAILED' } },
            });

            if (offer) {
                // eslint-disable-next-line prefer-destructuring
                offer_id = offer.offer_id;
            } else {
                // eslint-disable-next-line no-await-in-loop
                const bid = await Models.bids.findOne({
                    where: { data_set_id: response[i].datasets[0], status: { [Models.Sequelize.Op.not]: 'FAILED' } },
                });

                    // eslint-disable-next-line prefer-destructuring
                if (bid) { offer_id = bid.offer_id; }
            }

            // eslint-disable-next-line prefer-destructuring
            response[i].dataset_id = response[i].datasets[0];
            response[i].offer_id = offer_id;
            delete response[i].datasets;
        }

        res.status(200);
        res.send(response);
    }

    async handleStagingDataGet(req, res) {
        this.logger.api('GET: Staging data get request received.');

        const data = await this.documentStorage.findStagingData();

        res.status(200);
        res.send({ data, status: 'COMPLETED' });
    }

    async handleStagingDataCreate(req, res) {
        this.logger.api('POST: Staging data create request received.');
        if (!req.body) {
            res.status(400);
            res.send({
                message: 'Body is missing',
            });
            return;
        }

        await this.documentStorage.createStagingData(req.body);

        res.status(200);
        res.send({ status: 'COMPLETED' });
    }

    async handleStagingDataRemove(req, res) {
        this.logger.api('POST: Staging data remove request received.');
        if (!req.body) {
            res.status(400);
            res.send({
                message: 'Body is missing',
            });
            return;
        }

        await this.documentStorage.removeStagingData(req.body);

        res.status(200);
        res.send({ status: 'COMPLETED' });
    }


    async handleStagingDataPublish(req, res) {
        this.logger.api('POST: Staging data publish request received.');

        const data = await this.documentStorage.findAndRemoveStagingData();
        data.forEach((v) => { delete v._id; });
        const handler_id = await this.importService.importDataset(JSON.stringify({ '@graph': data }), 'ot-json');

        res.status(200);
        res.send({
            handler_id,
        });
    }
}

module.exports = DCController;

