const uuidv4 = require('uuid/v4');
const Models = require('../../models');
const Utilities = require('../Utilities');
const ImportUtilities = require('../ImportUtilities');
const constants = require('../constants');
const { QueryTypes } = require('sequelize');
/**
 * Encapsulates DV related methods
 */
class DVController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.remoteControl = ctx.remoteControl;
        this.blockchain = ctx.blockchain;
        this.emitter = ctx.emitter;

        this.transport = ctx.transport;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
        this.importService = ctx.importService;
        this.profileService = ctx.profileService;
        this.dvService = ctx.dvService;

        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('OT-JSON', 'ot-json');
        this.mapping_standards_for_event.set('GS1-EPCIS', 'gs1');
        this.mapping_standards_for_event.set('GRAPH', 'ot-json');
        this.mapping_standards_for_event.set('WOT', 'wot');

        this.trading_type_purchased = 'PURCHASED';
        this.trading_type_sold = 'SOLD';
        this.trading_type_all = 'ALL';
        this.trading_types = [
            this.trading_type_purchased, this.trading_type_sold, this.trading_type_all,
        ];
    }

    /**
     * Sends query to the network.
     * @param query Query
     * @returns {Promise<*>}
     */
    async queryNetwork(query, response) {
        this.logger.info(`Query handling triggered with ${JSON.stringify(query)}.`);

        const queryId = uuidv4();

        try {
            await this.commandExecutor.add({
                name: 'dvQueryNetworkCommand',
                delay: 0,
                data: {
                    queryId,
                    query,
                },
                transactional: false,
            });
        } catch (error) {
            this.logger.error(`Failed query network. ${error}.`);
            response.status(400);
            response.send({
                message: error.message,
            });
            return;
        }

        return queryId;
    }

    async handleNetworkQueryStatus(id, response) {
        this.logger.info(`Query of network status triggered with ID ${id}`);
        try {
            const networkQuery = await Models.network_queries.find({ where: { id } });
            response.status(200);
            response.send({
                status: networkQuery.status,
                query_id: networkQuery.id,
            });
        } catch (error) {
            console.log(error);
            response.status(400);
            response.send({
                error: `Fail to process network query status for ID ${id}.`,
            });
        }
    }

    async getNetworkQueryResponses(query_id, response) {
        this.logger.info(`Query for network response triggered with query ID ${query_id}`);

        let responses = await Models.network_query_responses.findAll({
            where: {
                query_id,
            },
        });

        responses = responses.map(response => ({
            datasets: JSON.parse(response.data_set_ids),
            stake_factor: response.stake_factor,
            reply_id: response.reply_id,
            node_id: response.node_id,
        }));

        response.status(200);
        response.send(responses);
    }

    async getTradingData(req, res) {
        this.logger.api('GET: Get trading data.');
        const requestedType = req.params.type;
        if (!requestedType || !this.trading_types.includes(requestedType)) {
            res.status(400);
            res.send({
                message: 'Param type with values: PURCHASED, SOLD or ALL is required.',
            });
        }
        // todo pass blockchain identity
        const normalizedIdentity = this.profileService.getIdentity();
        const whereCondition = {};
        if (requestedType === this.trading_type_purchased) {
            whereCondition.buyer_erc_id = normalizedIdentity;
        } else if (requestedType === this.trading_type_sold) {
            whereCondition.seller_erc_id = normalizedIdentity;
        }

        const tradingData = await Models.data_trades.findAll({
            where: whereCondition,
            order: [
                ['timestamp', 'DESC'],
            ],
        });

        const allDatasets = tradingData.map(element => element.data_set_id)
            .filter((value, index, self) => self.indexOf(value) === index);

        const allMetadata = await this.importService.getMultipleDatasetMetadata(allDatasets);

        const returnArray = [];
        tradingData.forEach((element) => {
            const { datasetHeader } =
                allMetadata.find(metadata => metadata._key === element.data_set_id);
            const type = normalizedIdentity === element.buyer_erc_id ? 'PURCHASED' : 'SOLD';
            returnArray.push({
                data_set: {
                    id: element.data_set_id,
                    name: datasetHeader.datasetTitle,
                    description: datasetHeader.datasetDescription,
                    tags: datasetHeader.datasetTags,
                },
                ot_json_object_id: element.ot_json_object_id,
                buyer_erc_id: element.buyer_erc_id,
                buyer_node_id: element.buyer_node_id,
                seller_erc_id: element.seller_erc_id,
                seller_node_id: element.seller_node_id,
                price_in_trac: element.price_in_trac,
                purchase_id: element.purchase_id,
                timestamp: element.timestamp,
                type,
                status: element.status,
            });
        });

        res.status(200);
        res.send(returnArray);
    }

    /**
     * Handles data read request
     * @param data_set_id - Dataset to be read
     * @param reply_id - Id of DH reply previously sent to user
     * @param res - API result object
     * @returns null
     */
    async handleDataReadRequest(data_set_id, reply_id, res) {
        this.logger.info(`Choose offer triggered with reply ID ${reply_id} and import ID ${data_set_id}`);

        const offer = await Models.network_query_responses.findOne({
            where: {
                reply_id,
            },
        });

        if (offer == null) {
            res.status(400);
            res.send({ message: 'Reply not found' });
            return;
        }
        try {
            const dataInfo = await Models.data_info.findOne({
                where: { data_set_id },
            });

            if (dataInfo) {
                const message = `I've already stored data for data set ID ${data_set_id}.`;
                this.logger.trace(message);
                res.status(200);
                res.send({ message });
                return;
            }

            const checkResult = await this.dvService.checkFingerprintData(data_set_id, offer);

            if (!checkResult.passed) {
                this.logger.trace(checkResult.message);
                res.status(400);
                res.send({ message: checkResult.message });
                return;
            }

            const handler_data = {
                data_set_id,
                reply_id,
            };
            const inserted_object = await Models.handler_ids.create({
                status: 'PENDING',
                data: JSON.stringify(handler_data),
            });
            const handlerId = inserted_object.dataValues.handler_id;
            this.logger.info(`Read offer for query ${offer.query_id} with handler id ${handlerId} initiated.`);
            this.remoteControl.offerInitiated(`Read offer for query ${offer.query_id} with handler id ${handlerId} initiated.`);

            res.status(200);
            res.send({
                handler_id: handlerId,
            });

            this.commandExecutor.add({
                name: 'dvDataReadRequestCommand',
                delay: 0,
                data: {
                    dataSetId: data_set_id,
                    replyId: reply_id,
                    handlerId,
                    nodeId: offer.node_id,
                },
                transactional: false,
            });
        } catch (e) {
            const message = `Failed to handle offer ${offer.id} for query ${offer.query_id} handled. ${e}.`;
            res.status(400);
            res.send({ message });
        }
    }

    /**
     * Handles permissioned data read request
     * @param request
     * @param response
     * @returns null
     */
    async handlePermissionedDataReadRequest(request, response) {
        this.logger.api('Private data network read request received.');

        if (!request.body || !request.body.seller_node_id
            || !request.body.data_set_id
            || !request.body.ot_object_id) {
            request.status(400);
            request.send({ message: 'Params data_set_id,ot_object_id and seller_node_id are required.' });
        }
        const { data_set_id, ot_object_id, seller_node_id } = request.body;
        const handler_data = {
            data_set_id,
            ot_object_id,
            seller_node_id,
        };
        const inserted_object = await Models.handler_ids.create({
            status: 'PENDING',
            data: JSON.stringify(handler_data),
        });
        const { handler_id } = inserted_object.dataValues;
        this.logger.info(`Read private data with id ${ot_object_id} with handler id ${handler_id} initiated.`);

        response.status(200);
        response.send({
            handler_id,
        });

        this.commandExecutor.add({
            name: 'dvPermissionedDataReadRequestCommand',
            delay: 0,
            data: {
                data_set_id,
                ot_object_id,
                seller_node_id,
                handler_id,
            },
            transactional: false,
        });
    }

    async handlePermissionedDataReadResponse(message) {
        const {
            handler_id, ot_objects,
        } = message;
        const documentsToBeUpdated = [];
        ot_objects.forEach((otObject) => {
            otObject.relatedObjects.forEach((relatedObject) => {
                if (relatedObject.vertex.vertexType === 'Data') {
                    const permissionedDataHash = ImportUtilities
                        .calculatePermissionedDataHash(relatedObject.vertex.data.permissioned_data);
                    if (permissionedDataHash !== relatedObject.vertex.data.permissioned_data.permissioned_data_hash) { throw new Error(`Calculated permissioned data hash ${permissionedDataHash} differs from DC permissioned data hash ${relatedObject.vertex.data.permissioned_data.permissioned_data_hash}`); }
                    documentsToBeUpdated.push(relatedObject.vertex);
                }
            });
        });
        const promises = [];
        documentsToBeUpdated.forEach((document) => {
            promises.push(this.graphStorage.updateDocument('ot_vertices', document));
        });
        await Promise.all(promises);

        const handlerData = await Models.handler_ids.findOne({
            where: {
                handler_id,
            },
        });

        const { data_set_id, ot_object_id } = JSON.parse(handlerData.data);

        // todo pass blockchain identity
        await Models.data_sellers.create({
            data_set_id,
            ot_json_object_id: ot_object_id,
            seller_node_id: this.config.identity.toLowerCase(),
            seller_erc_id: Utilities.normalizeHex(this.profileService.getIdentity()),
            price: this.config.default_data_price,
        });


        await Models.handler_ids.update({
            status: 'COMPLETED',
        }, { where: { handler_id } });
    }


    async getPermissionedDataAvailable(req, res) {
        this.logger.api('GET: Permissioned data Available for purchase.');

        const query =
            'SELECT * FROM data_sellers DS WHERE NOT EXISTS(SELECT * FROM data_sellers MY WHERE ' +
            'MY.seller_erc_id IN (:seller_ercs) AND MY.data_set_id = DS.data_set_id AND ' +
            'MY.ot_json_object_id = DS.ot_json_object_id)';

        const allMyIdentities = this.blockchain.getAllBlockchainIds()
            .map(id => this.profileService.getIdentity(id));

        const data = await Models.sequelize.query(
            query,
            {
                replacements: { seller_ercs: allMyIdentities },
                type: QueryTypes.SELECT,
            },
        );

        const result = [];

        if (data.length > 0) {
            const not_owned_objects = {};
            const allDatasets = [];
            /*
               Creating a map of the following structure
               not_owned_objects: {
                    dataset_0x456: {
                        seller_0x123: [ot_object_0x789, ...]
                        ...,
                    },
                    ...
               }
             */
            data.forEach((obj) => {
                const {
                    data_set_id,
                    blockchain_id,
                    seller_node_id,
                    ot_json_object_id: ot_object_id,
                    seller_erc_id,
                } = obj;


                if (!not_owned_objects[data_set_id]) {
                    // Add new dataset and seller and object
                    allDatasets.push(data_set_id);

                    not_owned_objects[data_set_id] = {};

                    not_owned_objects[data_set_id][seller_node_id] = {
                        ot_objects: [ot_object_id],
                        identities: [{
                            blockchain_id,
                            seller_erc_id,
                        }],
                    };
                } else if (!not_owned_objects[data_set_id][seller_node_id]) {
                    // Add new seller and object
                    not_owned_objects[data_set_id][seller_node_id] = {
                        ot_objects: [ot_object_id],
                        identities: [{
                            blockchain_id,
                            seller_erc_id,
                        }],
                    };
                } else if (!not_owned_objects[data_set_id][seller_node_id]
                    .ot_objects.includes(ot_object_id)) {
                    // Add new object
                    not_owned_objects[data_set_id][seller_node_id].ot_objects
                        .push(ot_object_id);
                }


                if (!not_owned_objects[data_set_id][seller_node_id]
                    .identities.find(e => e.blockchain_id === blockchain_id)) {
                    // Add new blockchain and appropriate identity
                    not_owned_objects[data_set_id][seller_node_id].identities.push({
                        blockchain_id,
                        seller_erc_id,
                    });
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
                not_owned_objects[datasetId].metadata = {
                    datasetTitle: datasetHeader.datasetTitle,
                    datasetTags: datasetHeader.datasetTags,
                    datasetDescription: datasetHeader.datasetDescription,
                    timestamp: dataInfo.import_timestamp,
                    creator_identities: ImportUtilities.extractDatasetIdentities(datasetHeader),
                    creator_wallets: JSON.parse(dataInfo.data_provider_wallets),
                };
            });

            for (const dataset in not_owned_objects) {
                for (const data_seller in not_owned_objects[dataset]) {
                    if (data_seller !== 'metadata') {
                        result.push({
                            seller_node_id: data_seller,
                            timestamp: (new Date(not_owned_objects[dataset].metadata.timestamp))
                                .getTime(),
                            dataset: {
                                id: dataset,
                                name: not_owned_objects[dataset].metadata.datasetTitle,
                                description: not_owned_objects[dataset].metadata.datasetDescription,
                                tags: not_owned_objects[dataset].metadata.datasetTags,
                                creator_wallet: not_owned_objects[dataset].metadata.creator_wallet,
                                creator_identities:
                                    not_owned_objects[dataset].metadata.creator_identities,
                            },
                            ot_objects: not_owned_objects[dataset][data_seller].ot_objects,
                            seller_identities: not_owned_objects[dataset][data_seller].identities,
                        });
                    }
                }
            }
        }

        res.status(200);
        res.send(result);
    }

    async getPermissionedDataPrice(req, res) {
        this.logger.api('POST: Get permissioned data price.');
        if (req.body == null
            || req.body.data_set_id == null
            || req.body.seller_node_id == null
            || req.body.ot_object_id == null) {
            res.status(400);
            res.send({ message: 'Params data_set_id, seller_node_id and ot_json_object_id are required.' });
        }

        const {
            data_set_id, seller_node_id, ot_object_id,
        } = req.body;
        const inserted_object = await Models.handler_ids.create({
            data: JSON.stringify({
                data_set_id, seller_node_id, ot_object_id,
            }),
            status: 'PENDING',
        });

        const handlerId = inserted_object.dataValues.handler_id;

        await this.sendPermissionedDataPriceRequest(
            data_set_id,
            seller_node_id,
            ot_object_id,
            handlerId,
        );

        res.status(200);
        res.send({
            handler_id: handlerId,
        });
    }

    async sendNetworkPurchase(request, response) {
        this.logger.api('POST: Permissioned data purchase request.');
        if (request.body == null
            || request.body.data_set_id == null
            || request.body.seller_node_id == null
            || request.body.ot_object_id == null) {
            response.status(400);
            response.send({ message: 'Params data_set_id, seller_node_id and ot_object_id are required.' });
            return;
        }
        const {
            data_set_id, seller_node_id, ot_object_id, blockchain_id,
        } = request.body;
        const inserted_object = await Models.handler_ids.create({
            data: JSON.stringify({
                data_set_id, seller_node_id, ot_object_id,
            }),
            status: 'REQUESTED',
        });
        const { handler_id } = inserted_object.dataValues;
        response.status(200);
        response.send({
            handler_id,
        });

        const commandData = {
            data_set_id,
            handler_id,
            ot_object_id,
            seller_node_id,
            blockchain_id,
        };

        await this.commandExecutor.add({
            name: 'dvPurchaseRequestCommand',
            data: commandData,
        });
    }

    async sendPermissionedDataPriceRequest(dataSetId, nodeId, otJsonObjectId, handlerId) {
        const { node_wallet, node_private_key } = this.blockchain.getWallet().response;

        const message = {
            data_set_id: dataSetId,
            handler_id: handlerId,
            ot_json_object_id: otJsonObjectId,
            wallet: node_wallet,
        };
        const dataPriceRequestObject = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                message,
                node_private_key,
            ),
        };

        await this.transport.sendPermissionedDataPriceRequest(
            dataPriceRequestObject,
            nodeId,
        );
    }

    async handleNetworkPurchaseResponse(response) {
        const {
            handler_id, status, message, encoded_data,
            permissioned_data_root_hash, encoded_data_root_hash,
            permissioned_data_array_length, permissioned_data_original_length, blockchain_id,
        } = response;

        const commandData = {
            handler_id,
            blockchain_id,
            status,
            message,
            encoded_data,
            permissioned_data_root_hash,
            encoded_data_root_hash,
            permissioned_data_array_length,
            permissioned_data_original_length,
        };

        await this.commandExecutor.add({
            name: 'dvPurchaseInitiateCommand',
            data: commandData,
        });
    }

    async handlePermissionedDataPriceResponse(response) {
        const {
            handler_id, status, prices,
        } = response;

        const handler = await Models.handler_ids.findOne({
            where: {
                handler_id,
            },
        });

        const {
            data_set_id,
            seller_node_id,
            ot_object_id,
        } = JSON.parse(handler.data);

        const allMyBlockchainIds = this.blockchain.getAllBlockchainIds();

        if (status === 'COMPLETED') {
            const promises = [];

            const existingPrices = await Models.data_sellers.findAll({
                where: {
                    data_set_id,
                    seller_node_id,
                    ot_json_object_id: ot_object_id,
                },
            });

            for (const price_response of prices) {
                if (allMyBlockchainIds.includes(price_response.blockchain_id)) {
                    const entryExists = !!existingPrices && !!existingPrices.find(elem =>
                        elem.dataValues.blockchain_id === price_response.blockchain_id);
                    if (entryExists) {
                        promises.push(Models.data_sellers.update(
                            {
                                price: price_response.price_in_trac,
                            },
                            {
                                where: {
                                    blockchain_id: price_response.blockchain_id,
                                    data_set_id,
                                    seller_node_id,
                                    ot_json_object_id: ot_object_id,
                                },
                            },
                        ));
                    } else {
                        promises.push(Models.data_sellers.create({
                            data_set_id,
                            blockchain_id: price_response.blockchain_id,
                            ot_json_object_id: ot_object_id,
                            seller_node_id,
                            seller_erc_id: price_response.seller_erc_id,
                            price: price_response.price_in_trac,
                        }));
                    }
                }
            }
            await Promise.all(promises);
        }

        await Models.handler_ids.update({
            data: JSON.stringify({
                message: {
                    data_set_id,
                    seller_node_id,
                    ot_object_id,
                    prices,
                },
            }),
            status,
        }, {
            where: {
                handler_id,
            },
        });
    }


    /**
     * Handles data read request
     * @param queryId
     * @param dataSetId
     * @param replyId
     */
    async handleDataReadExportRequest(req, res) {
        this.logger.api('POST: Network read and export request received.');

        if (req.body == null || req.body.reply_id == null
            || req.body.data_set_id == null) {
            res.status(400);
            res.send({ message: 'Params reply_id, data_set_id are required.' });
            return;
        }
        const { reply_id, data_set_id } = req.body;
        let standard_id =
            this.mapping_standards_for_event.get(req.body.standard_id);
        if (!standard_id) {
            standard_id = 'ot-json';
        }
        this.logger.info(`Choose offer triggered with reply ID ${reply_id} and import ID ${data_set_id}`);

        const offer = await Models.network_query_responses.findOne({
            where: {
                reply_id,
            },
        });

        if (offer == null) {
            res.status(400);
            res.send({ message: 'Reply not found' });
            return;
        }
        try {
            const handler_data = {
                data_set_id,
                reply_id,
                standard_id,
                export_status: 'PENDING',
                import_status: 'PENDING',
                readExport: true,
            };
            const inserted_object = await Models.handler_ids.create({
                status: 'PENDING',
                data: JSON.stringify(handler_data),
            });

            const dataInfo = await Models.data_info.findOne({
                where: { data_set_id },
            });
            if (dataInfo) {
                handler_data.import_status = 'COMPLETED';
                await Models.handler_ids.update(
                    {
                        data: JSON.stringify(handler_data),
                    },
                    {
                        where: {
                            handler_id: inserted_object.handler_id,
                        },
                    },
                );

                const commandSequence = [
                    'exportDataCommand',
                    'exportWorkerCommand',
                ];

                await this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: {
                        handlerId: inserted_object.handler_id,
                        datasetId: data_set_id,
                        standardId: standard_id,
                    },
                    transactional: false,
                });
            } else {
                const checkResult = await this.dvService.checkFingerprintData(data_set_id, offer);

                if (!checkResult.passed) {
                    this.logger.trace(checkResult.message);
                    res.status(400);
                    res.send({ message: checkResult.message });
                    return;
                }

                this.logger.info(`Read offer for query ${offer.query_id} with handler id ${inserted_object.dataValues.handler_id} initiated.`);
                this.remoteControl.offerInitiated(`Read offer for query ${offer.query_id} with handler id ${inserted_object.dataValues.handler_id} initiated.`);


                this.commandExecutor.add({
                    name: 'dvDataReadRequestCommand',
                    delay: 0,
                    data: {
                        dataSetId: data_set_id,
                        replyId: reply_id,
                        handlerId: inserted_object.dataValues.handler_id,
                        nodeId: offer.node_id,
                    },
                    transactional: false,
                });
            }

            res.status(200);
            res.send({
                handler_id: inserted_object.dataValues.handler_id,
            });
        } catch (e) {
            const message = `Failed to handle offer ${offer.id} for query ${offer.query_id} handled. ${e}.`;
            res.status(400);
            res.send({ message });
        }
    }

    async handleDataLocationResponse(message) {
        const queryId = message.id;

        // Find the query.
        const networkQuery = await Models.network_queries.findOne({
            where: { id: queryId },
        });

        if (!networkQuery) {
            throw Error(`Didn't find query with ID ${queryId}.`);
        }

        if (networkQuery.status !== 'OPEN') {
            this.logger.info('Too late. Query closed.');
        } else {
            await this.commandExecutor.add({
                name: 'dvDataLocationResponseCommand',
                delay: 0,
                data: {
                    queryId,
                    wallet: message.wallet,
                    nodeId: message.nodeId,
                    imports: message.imports,
                    dataPrice: message.dataPrice,
                    dataSize: message.dataSize,
                    stakeFactor: message.stakeFactor,
                    replyId: message.replyId,
                },
                transactional: false,
            });
        }
    }

    async handleDataReadResponseFree(message) {
        // Is it the chosen one?
        const replyId = message.id;

        // Find the particular reply.
        const networkQueryResponse = await Models.network_query_responses.findOne({
            where: { reply_id: replyId },
        });

        if (!networkQueryResponse) {
            throw Error(`Didn't find query reply with ID ${replyId}.`);
        }
        await this.commandExecutor.add({
            name: 'dvDataReadResponseFreeCommand',
            delay: 0,
            data: {
                message,
            },
            transactional: false,
        });
    }

    async handleGetFingerprint(req, res) {
        this.logger.api('GET: Fingerprint request received.');
        const { dataset_id } = req.params;
        if (dataset_id == null) {
            res.status(400);
            res.send({
                message: 'data_set_id parameter is missing',
            });
            return;
        }

        const allBlockchainIds = this.blockchain.getAllBlockchainIds();
        const promises = allBlockchainIds.map(blockchain_id =>
            this.blockchain.getRootHash(dataset_id, blockchain_id).response);
        const allRootHashes = await Promise.all(promises);

        const result = [];
        let foundHashes = 0;
        for (let i = 0; i < allRootHashes.length; i += 1) {
            const blockchain_id = allBlockchainIds[i];
            const dataRootHash = allRootHashes[i];

            if (dataRootHash) {
                if (!Utilities.isZeroHash(dataRootHash)) {
                    foundHashes += 1;
                    result.push({
                        blockchain_id,
                        root_hash: dataRootHash,
                    });
                } else {
                    result.push({
                        blockchain_id,
                        message: `Root hash not found for ${dataset_id}`,
                    });
                }
            } else {
                result.push({
                    blockchain_id,
                    message: `Root hash not found for ${dataset_id}`,
                });
            }
        }
        if (foundHashes > 0) {
            res.status(200);
        } else {
            res.status(404);
        }
        res.send(result);
    }

    /**
     * Handle new purchase on the blockchain and add the node that bought data as a new
     * data seller
     * @param purchase_id
     * @param blockchain_id
     * @param seller_erc_ids
     * @param seller_node_id
     * @param data_set_id
     * @param ot_object_id
     * @param prices
     * @returns {Promise<void>}
     */
    async handleNewDataSeller(
        purchase_id, blockchain_id, seller_erc_ids, seller_node_id,
        data_set_id, ot_object_id, prices,
    ) {
        /*
        * [x] Check that I have the dataset
        * [x] Check that I don't have the ot-object
        * [x] Check that the seller has a purchase on blockchain
        * [x] Check that the ot-object exists in the dataset
        * [x] Check that the permissioned data hash matches the hash in the ot-object
        * */

        const dataInfo = await Models.data_info.findAll({ where: { data_set_id } });
        if (!dataInfo || !Array.isArray(dataInfo) || !dataInfo.length > 0) {
            this.logger.info(`Dataset ${data_set_id} not imported on node, skipping adding data seller.`);
            return;
        }

        const allMyBlockchains = this.blockchain.getAllBlockchainIds();
        const allMyIdentities = allMyBlockchains.map(id => this.profileService.getIdentity(id));

        const myDataPrice = await Models.data_sellers.findAll({
            where: {
                data_set_id,
                ot_json_object_id: ot_object_id,
                seller_erc_id: {
                    [Models.Sequelize.Op.in]: allMyIdentities,
                },
            },
        });

        if (myDataPrice && Array.isArray(myDataPrice) && myDataPrice.length > 0) {
            this.logger.info(`I already have permissioned data of object ${ot_object_id}` +
                ` from dataset ${data_set_id}`);
            return;
        }

        if (!allMyBlockchains.includes(blockchain_id)) {
            this.logger.info(`I do not have permissioned data of object ${ot_object_id}` +
                ` from dataset ${data_set_id} but I cannot verify purchase on blockchain ${blockchain_id}`);
            return;
        }

        const purchase = await this.blockchain.getPurchase(purchase_id, blockchain_id).response;
        const {
            seller,
            buyer,
            originalDataRootHash,
        } = purchase;
        const seller_erc_id = seller_erc_ids.find(e => e.blockchain_id === blockchain_id).identity;

        if (!Utilities.compareHexStrings(buyer, seller_erc_id)) {
            this.logger.warn('New data seller\'s ERC-725 identity does not match' +
                ` the purchase buyer identity ${Utilities.normalizeHex(buyer)}`);
            return;
        }

        const otObject = await this.importService.getOtObjectById(data_set_id, ot_object_id);
        if (!otObject || !otObject.properties || !otObject.properties.permissioned_data) {
            this.logger.info(`Object ${ot_object_id} not found in dataset ${data_set_id} ` +
                'or does not contain permissioned data.');
            return;
        }

        const permissionedDataHash = otObject.properties.permissioned_data.permissioned_data_hash;
        if (!Utilities.compareHexStrings(permissionedDataHash, originalDataRootHash)) {
            this.logger.info('Purchase permissioned data root hash does not match ' +
                'the permissioned data root hash from dataset.');
            return;
        }

        const promises = [];
        for (const seller_object of seller_erc_ids) {
            const { blockchain_id, identity: seller_erc_id } = seller_object;

            const price = prices.find(e => e.blockchain_id === blockchain_id).price_in_trac;

            if (allMyBlockchains.includes(blockchain_id)) {
                promises.push(Models.data_sellers.create({
                    data_set_id,
                    blockchain_id,
                    ot_json_object_id: ot_object_id,
                    seller_node_id,
                    seller_erc_id,
                    price,
                }));
            }
        }

        await Promise.all(promises);

        this.logger.notify(`Saved ${seller_node_id} as new seller for permissioned data ` +
            `of object ${ot_object_id} from dataset ${data_set_id}`);
    }
}

module.exports = DVController;

