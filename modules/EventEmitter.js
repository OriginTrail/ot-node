const Challenge = require('./Challenge');
const Utilities = require('./Utilities');
const Models = require('../models');
const ImportUtilities = require('./ImportUtilities');
const ObjectValidator = require('./validator/object-validator');
const bytes = require('utf8-length');

const events = require('events');

class EventEmitter {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.product = ctx.product;
        this.web3 = ctx.web3;
        this.graphStorage = ctx.graphStorage;
        this.appState = ctx.appState;

        this._MAPPINGS = {};
        this._MAX_LISTENERS = 15; // limits the number of listeners in order to detect memory leaks
    }

    /**
     * Initializes event listeners
     */
    initialize() {
        this._initializeAPIEmitter();
        this._initializeP2PEmitter();
        this._initializeBlockchainEmitter();
        this._initializeInternalEmitter();
    }

    /**
     * Gets appropriate event emitter based on the event
     * @param event
     * @return {*}
     * @private
     */
    _getEmitter(event) {
        for (const prefix in this._MAPPINGS) {
            if (event.startsWith(prefix)) {
                const index = this._MAPPINGS[prefix].EVENTS.indexOf(event);
                return this._MAPPINGS[prefix].EMITTERS[Math.floor(index / this._MAX_LISTENERS)];
            }
        }
        throw new Error(`No listeners for event ${event}`);
    }

    /**
     * Register event handler
     * @param event
     * @param fn
     * @private
     */
    _on(event, fn) {
        if (event.indexOf('-') === -1) {
            throw new Error(`Invalid event prefix for ${event}. Event name convention is PREFIX-EVENT`);
        }
        const key = event.split('-')[0];
        if (!this._MAPPINGS[key]) {
            this._MAPPINGS[key] = {
                EVENTS: [],
                EMITTERS: [],
            };
        }

        const eventMapping = this._MAPPINGS[key];
        eventMapping.EVENTS.push(event);
        const emitterIndex = Math.floor(eventMapping.EVENTS.length / this._MAX_LISTENERS);
        if (eventMapping.EMITTERS.length < emitterIndex + 1) {
            const emitter = new events.EventEmitter();
            emitter.setMaxListeners(this._MAX_LISTENERS);
            eventMapping.EMITTERS.push(emitter);
        }
        this._getEmitter(event).on(event, fn);
    }

    /**
     * Initializes API related emitter
     * @private
     */
    _initializeAPIEmitter() {
        const {
            dhService,
            importer,
            blockchain,
            product,
            logger,
            remoteControl,
            config,
            appState,
            profileService,
            dcService,
            dvController,
            notifyError,
        } = this.ctx;

        this._on('api-network-query-responses', async (data) => {
            const { query_id } = data;
            logger.info(`Query for network response triggered with query ID ${query_id}`);

            let responses = await Models.network_query_responses.findAll({
                where: {
                    query_id,
                },
            });

            responses = responses.map(response => ({
                imports: JSON.parse(response.imports),
                data_size: response.data_size,
                data_price: response.data_price,
                stake_factor: response.stake_factor,
                reply_id: response.reply_id,
            }));

            data.response.status(200);
            data.response.send(responses);
        });

        this._on('api-trail', (data) => {
            logger.info(`Get trail triggered with query ${JSON.stringify(data.query)}`);
            product.getTrailByQuery(data.query).then((res) => {
                if (res.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }
                data.response.send(res);
            }).catch((error) => {
                logger.error(`Failed to get trail for query ${JSON.stringify(data.query)}`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            });
        });

        this._on('api-query-local-import', async (data) => {
            const { import_id: importId } = data;
            logger.info(`Get vertices trigered for import ID ${importId}`);
            try {
                const result = await dhService.getImport(importId);

                if (result.vertices.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }

                const rawData = 'raw-data' in data.request.headers && data.request.headers['raw-data'] === 'true';

                if (rawData) {
                    data.response.send(result);
                } else {
                    data.response
                        .send(ImportUtilities.normalizeImport(result.vertices, result.edges));
                }
            } catch (error) {
                logger.error(`Failed to get vertices for import ID ${importId}.`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            }
        });

        this._on('api-import-info', async (data) => {
            const { importId } = data;
            logger.info(`Get imported vertices triggered for import ID ${importId}`);
            try {
                const dataInfo = await Models.data_info.find({ where: { import_id: importId } });

                if (!dataInfo) {
                    logger.info(`Import data for import ID ${importId} does not exist.`);
                    data.response.status(404);
                    data.response.send({
                        message: `Import data for import ID ${importId} does not exist`,
                    });
                    return;
                }

                const result = await dhService.getImport(importId);

                // Check if packed to fix issue with double classes.
                const filtered = result.vertices.filter(v => v._dc_key);
                if (filtered.length > 0) {
                    result.vertices = filtered;
                    ImportUtilities.unpackKeys(result.vertices, result.edges);
                }

                const dataimport =
                    await Models.data_info.findOne({ where: { import_id: importId } });

                if (result.vertices.length === 0 || dataimport == null) {
                    data.response.status(204);
                    data.response.send(result);
                } else {
                    data.response.status(200);
                    data.response.send({
                        import: ImportUtilities.normalizeImport(
                            result.vertices,
                            result.edges,
                        ),
                        import_hash: ImportUtilities.importHash(
                            result.vertices,
                            result.edges,
                        ),
                        root_hash: dataimport.root_hash,
                        transaction: dataimport.transaction_hash,
                        data_provider_wallet: dataimport.data_provider_wallet,
                    });
                }
            } catch (error) {
                logger.error(`Failed to get vertices for import ID ${importId}.`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            }
        });

        this._on('api-get-imports', async (data) => {
            logger.info(`Get imports triggered with query ${JSON.stringify(data.query)}`);

            try {
                const res = await product.getImports(data.query);
                if (res.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }
                data.response.send(res);
            } catch (error) {
                logger.error(`Failed to get imports for query ${JSON.stringify(data.query)}`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            }
        });

        this._on('api-imports-info', async (data) => {
            logger.debug('Get import ids');
            try {
                const dataimports = await Models.data_info.findAll();
                data.response.status(200);
                data.response.send(dataimports.map(di => ({
                    import_id: di.import_id,
                    total_documents: di.total_documents,
                    root_hash: di.root_hash,
                    import_hash: di.import_hash,
                    data_size: di.data_size,
                    transaction_hash: di.transaction_hash,
                    data_provider_wallet: di.data_provider_wallet,
                })));
            } catch (e) {
                logger.error('Failed to get information about imports', e);
                data.response.status(500);
                data.response.send({
                    message: 'Failed to get information about imports',
                });
            }
        });

        this._on('api-query', (data) => {
            logger.info(`Get veritces triggered with query ${JSON.stringify(data.query)}`);
            product.getVertices(data.query).then((res) => {
                if (res.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }
                data.response.send(res);
            }).catch((error) => {
                logger.error(`Failed to get vertices for query ${JSON.stringify(data.query)}`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: `Failed to get vertices for query ${JSON.stringify(data.query)}`,
                });
            });
        });

        this._on('api-get_root_hash', (data) => {
            const dataSetId = data.query.data_set_id;
            if (dataSetId == null) {
                data.response.status(400);
                data.response.send({
                    message: 'data_set_id parameter query is missing',
                });
                return;
            }
            logger.info(`Get root hash triggered with data set ${dataSetId}`);
            blockchain.getRootHash(dataSetId).then((dataRootHash) => {
                if (dataRootHash) {
                    if (!Utilities.isZeroHash(dataRootHash)) {
                        data.response.status(200);
                        data.response.send({
                            root_hash: dataRootHash,
                        });
                    } else {
                        data.response.status(404);
                        data.response.send({
                            message: `Root hash not found for query ${JSON.stringify(data.query)}`,
                        });
                    }
                } else {
                    data.response.status(500);
                    data.response.send({
                        message: `Failed to get root hash for query ${JSON.stringify(data.query)}`,
                    });
                }
            }).catch((err) => {
                logger.error(`Failed to get root hash for query ${JSON.stringify(data.query)}`);
                notifyError(err);
                data.response.status(500);
                data.response.send({
                    message: `Failed to get root hash for query ${JSON.stringify(data.query)}`, // TODO rethink about status codes
                });
            });
        });

        this._on('api-network-query', (data) => {
            logger.info(`Network-query handling triggered with query ${JSON.stringify(data.query)}.`);
            if (!appState.enoughFunds) {
                data.response.status(400);
                data.response.send({
                    message: 'Insufficient funds',
                });
                return;
            }

            dvController.queryNetwork(data.query)
                .then((queryId) => {
                    data.response.status(201);
                    data.response.send({
                        message: 'Query sent successfully.',
                        query_id: queryId,
                    });
                    dvController.handleQuery(queryId, 60000);
                }).catch((error) => {
                    logger.error(`Failed query network. ${error}.`);
                    notifyError(error);
                });
        });

        this._on('api-choose-offer', async (data) => {
            if (!appState.enoughFunds) {
                return;
            }
            const failFunction = (error) => {
                logger.warn(error);
                data.response.status(400);
                data.response.send({
                    message: 'Failed to handle query',
                    data: [],
                });
            };
            const { query_id, reply_id, data_set_id } = data;
            logger.info(`Choose offer triggered with query ID ${query_id}, reply ID ${reply_id} and import ID ${data_set_id}`);

            // TODO: Load offer reply from DB
            const offer = await Models.network_query_responses.findOne({
                where: {
                    query_id,
                    reply_id,
                },
            });

            if (offer == null) {
                data.response.status(400);
                data.response.send({ message: 'Reply not found' });
                return;
            }
            try {
                dvController.handleDataReadRequest(query_id, data_set_id, reply_id);
                logger.info(`Read offer ${offer.id} for query ${offer.query_id} initiated.`);
                remoteControl.offerInitiated(`Read offer ${offer.id} for query ${offer.query_id} initiated.`);
                data.response.status(200);
                data.response.send({
                    message: `Read offer ${offer.id} for query ${offer.query_id} initiated.`,
                });
            } catch (e) {
                failFunction(`Failed to handle offer ${offer.id} for query ${offer.query_id} handled. ${e}.`);
                notifyError(e);
            }
        });

        this._on('api-network-query-status', async (data) => {
            const { id, response } = data;
            logger.info(`Query of network status triggered with ID ${id}`);
            const networkQuery = await Models.network_queries.find({ where: { id } });
            if (networkQuery.status === 'FINISHED') {
                try {
                    const vertices = await dhService.dataLocationQuery(id);

                    response.status(200);
                    response.send({
                        status: `${networkQuery.status}`,
                        query_id: networkQuery.id,
                        vertices,
                    });
                } catch (error) {
                    logger.info(`Failed to process network query status for ID ${id}. ${error}.`);
                    notifyError(error);
                    response.status(500);
                    response.send({
                        error: 'Fail to process.',
                        query_id: networkQuery.id,
                    });
                }
            } else {
                response.status(200);
                response.send({
                    status: `${networkQuery.status}`,
                    query_id: networkQuery.id,
                });
            }
        });

        const processImport = async (response, error, data) => {
            if (response === null) {
                if (typeof (error.status) !== 'number') {
                    // TODO investigate why we get non numeric error.status
                    data.response.status(500);
                } else {
                    data.response.status(error.status);
                }
                data.response.send({
                    message: error.message,
                });
                remoteControl.importFailed(error);
                notifyError(error);
                return;
            }

            const {
                data_set_id,
                root_hash,
                total_documents,
                wallet, // TODO: Sender's wallet is ignored for now.
                vertices,
            } = response;

            try {
                const dataSize = bytes(JSON.stringify(vertices));
                await Models.data_info
                    .create({
                        data_set_id,
                        root_hash,
                        data_provider_wallet: config.node_wallet,
                        import_timestamp: new Date(),
                        total_documents,
                        data_size: dataSize,
                        transaction_hash: null,
                    }).catch((error) => {
                        logger.error(error);
                        notifyError(error);
                        data.response.status(500);
                        data.response.send({
                            message: error,
                        });
                        remoteControl.importFailed(error);
                    });

                if (data.replicate) {
                    this.emit('api-create-offer', {
                        dataSetId: data_set_id,
                        dataSizeInBytes: dataSize,
                        dataRootHash: root_hash,
                        response: data.response,
                    });
                } else {
                    data.response.status(201);
                    data.response.send({
                        message: 'Import success',
                        data_set_id,
                        wallet: config.node_wallet,
                    });
                    remoteControl.importSucceeded();
                }
            } catch (error) {
                logger.error(`Failed to register import. Error ${error}.`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
                remoteControl.importFailed(error);
            }
        };

        this._on('api-offer-status', async (data) => {
            const { external_id } = data;
            logger.info(`Offer status for external ID ${external_id} triggered.`);
            const offer = await Models.offers.findOne({ where: { external_id } });
            if (offer) {
                data.response.status(200);
                data.response.send({
                    status: offer.status,
                    message: offer.message,
                });
            } else {
                logger.error(`There is no offer for external ID ${external_id}`);
                data.response.status(404);
                data.response.send({
                    message: 'Offer not found',
                });
            }
        });

        this._on('api-create-offer', async (data) => {
            if (!appState.enoughFunds) {
                data.response.status(400);
                data.response.send({
                    message: 'Insufficient funds',
                });
                return;
            }
            const {
                dataSetId,
                holdingTimeInMinutes,
                tokenAmountPerHolder,
                litigationIntervalInMinutes,
            } = data;

            let {
                dataRootHash,
                dataSizeInBytes,
            } = data;

            try {
                logger.info(`Preparing to create offer for data set ${dataSetId}`);

                const dataset = await Models.data_info.findOne({
                    where: { data_set_id: dataSetId },
                });
                if (dataset == null) {
                    throw new Error('This data set does not exist in the database');
                }

                if (dataSizeInBytes == null) {
                    dataSizeInBytes = dataset.data_size;
                }

                if (dataRootHash == null) {
                    dataRootHash = dataset.root_hash;
                }

                const offerId = await dcService.createOffer(
                    dataSetId, dataRootHash, holdingTimeInMinutes, tokenAmountPerHolder,
                    dataSizeInBytes, litigationIntervalInMinutes,
                );

                data.response.status(201);
                data.response.send({
                    offer_id: offerId,
                });
            } catch (error) {
                logger.error(`Failed to create offer. ${error}.`);
                notifyError(error);
                data.response.status(405);
                data.response.send({
                    message: `Failed to start offer. ${error}.`,
                });
                remoteControl.failedToCreateOffer(`Failed to start offer. ${error}.`);
            }
        });


        this._on('api-gs1-import-request', async (data) => {
            try {
                logger.debug('GS1 import triggered');
                const responseObject = await importer.importXMLgs1(data.content);
                const { error } = responseObject;
                const { response } = responseObject;

                if (response === null) {
                    await processImport(null, error, data);
                } else {
                    await processImport(response, null, data);
                }
            } catch (error) {
                await processImport(null, error, data);
            }
        });

        this._on('api-wot-import-request', async (data) => {
            try {
                logger.debug('WOT import triggered');
                const responseObject = await importer.importWOT(data.content);
                const { error } = responseObject;
                const { response } = responseObject;

                if (response == null) {
                    await processImport(null, error, data);
                } else {
                    await processImport(response, null, data);
                }
            } catch (error) {
                await processImport(null, error, data);
            }
        });

        this._on('api-deposit-tokens', async (data) => {
            const { atrac_amount } = data;

            try {
                logger.info(`Deposit ${atrac_amount} ATRAC to profile triggered`);

                await profileService.depositTokens(atrac_amount);
                remoteControl.tokenDepositSucceeded(`${atrac_amount} ATRAC deposited to your profile`);

                data.response.status(200);
                data.response.send({
                    message: `Successfully deposited ${atrac_amount} ATRAC to profile`,
                });
            } catch (error) {
                logger.error(`Failed to deposit tokens. ${error}.`);
                notifyError(error);
                data.response.status(400);
                data.response.send({
                    message: `Failed to deposit tokens. ${error}.`,
                });
                remoteControl.tokensDepositFailed(`Failed to deposit tokens. ${error}.`);
            }
        });

        this._on('api-withdraw-tokens', async (data) => {
            const { atrac_amount } = data;

            try {
                logger.info(`Withdraw ${atrac_amount} ATRAC to wallet triggered`);

                await profileService.withdrawTokens(atrac_amount);

                data.response.status(200);
                data.response.send({
                    message: `Withdraw operation started for amount ${atrac_amount}.`,
                });
                // TODO notify Houston
                // remoteControl.tokensWithdrawSucceeded
                // (`Successfully withdrawn ${atrac_amount} ATRAC`);
            } catch (error) {
                logger.error(`Failed to withdraw tokens. ${error}.`);
                notifyError(error);
                data.response.status(400);
                data.response.send({
                    message: `Failed to withdraw tokens. ${error}.`,
                });
                remoteControl.tokensWithdrawFailed(`Failed to withdraw tokens. ${error}.`);
            }
        });
    }

    /**
     * Initializes blockchain related emitter
     * @private
     */
    _initializeBlockchainEmitter() {
        const {
            dhService,
            logger,
            config,
            appState,
            notifyError,
        } = this.ctx;

        this._on('eth-OfferCreated', async (eventData) => {
            if (!appState.enoughFunds) {
                return;
            }
            let {
                dcNodeId,
            } = eventData;

            dcNodeId = Utilities.denormalizeHex(dcNodeId).substring(24);
            const {
                offerId,
                dataSetId,
                dataSetSizeInBytes,
                holdingTimeInMinutes,
                litigationIntervalInMinutes,
                tokenAmountPerHolder,
            } = eventData;

            try {
                await dhService.handleOffer(
                    offerId, dcNodeId,
                    dataSetSizeInBytes, holdingTimeInMinutes, litigationIntervalInMinutes,
                    tokenAmountPerHolder, dataSetId,
                );
            } catch (e) {
                logger.warn(e.message);
            }
        });

        this._on('eth-LitigationInitiated', async (eventData) => {
            const {
                import_id,
                DH_wallet,
                requested_data_index,
            } = eventData;

            try {
                await dhService.litigationInitiated(
                    import_id,
                    DH_wallet,
                    requested_data_index,
                );
            } catch (error) {
                logger.error(`Failed to handle predetermined bid. ${error}.`);
                notifyError(error);
            }
        });

        this._on('eth-LitigationCompleted', async (eventData) => {
            const {
                import_id,
                DH_wallet,
                DH_was_penalized,
            } = eventData;

            if (config.node_wallet === DH_wallet) {
                // the node is DH
                logger.info(`Litigation has completed for import ${import_id}. DH has ${DH_was_penalized ? 'been penalized' : 'not been penalized'}`);
            }
        });
    }

    /**
     * Initializes P2P related emitter
     * @private
     */
    _initializeP2PEmitter() {
        const {
            dvService,
            logger,
            transport,
            dhService,
            dcService,
            dvController,
            notifyError,
        } = this.ctx;

        // sync
        this._on('kad-join', async (request, response) => {
            await transport.sendResponse(response, await transport.join());
        });

        this._on('kad-data-location-request', async (query) => {
            const { message, messageSignature } = query;
            if (ObjectValidator.validateSearchQueryObject(message.query)) {
                return;
            }
            logger.info(`Request for data ${message.query[0].value} from DV ${message.wallet} received`);

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message}`);
                return;
            }

            try {
                const {
                    id: msgId,
                    nodeId: msgNodeId,
                    wallet: msgWallet,
                    query: msgQuery,
                } = message;
                await dhService.handleDataLocationRequest(msgId, msgNodeId, msgWallet, msgQuery);
            } catch (error) {
                const errorMessage = `Failed to process data location request. ${error}.`;
                logger.warn(errorMessage);
                notifyError(error);
            }
        });

        // async
        this._on('kad-replication-response', async (request, response) => {
            await transport.sendResponse(response, {
                status: 'OK',
            });
            logger.info(`Data for replication arrived from ${transport.extractSenderID(request)}`);

            const message = transport.extractMessage(request);
            const dcNodeId = transport.extractSenderID(request);
            const offerId = message.payload.offer_id;
            const dataSetId = message.payload.data_set_id;
            const { edges } = message.payload;
            const litigationVertices = message.payload.litigation_vertices;
            const dcWallet = message.payload.dc_wallet;
            const litigationPublicKey = message.payload.litigation_public_key;
            const distributionPublicKey = message.payload.distribution_public_key;
            const distributionPrivateKey = message.payload.distribution_private_key;
            const distributionEpkChecksum = message.payload.distribution_epk_checksum;
            const litigationRootHash = message.payload.litigation_root_hash;
            const distributionRootHash = message.payload.distribution_root_hash;
            const distributionEpk = message.payload.distribution_epk;
            const distributionSignature = message.payload.distribution_signature;
            const transactionHash = message.payload.transaction_hash;

            await dhService.handleReplicationImport(
                offerId,
                dataSetId,
                dcNodeId,
                dcWallet,
                edges,
                litigationVertices,
                litigationPublicKey,
                distributionPublicKey,
                distributionPrivateKey,
                distributionEpkChecksum,
                litigationRootHash,
                distributionRootHash,
                distributionEpk,
                distributionSignature,
                transactionHash,
            );
            // TODO: send fail in case of fail.
        });

        // async
        this._on('kad-replication-request', async (request, response) => {
            await transport.sendResponse(response, {
                status: 'OK',
            });
            const message = transport.extractMessage(request);
            const { offerId, wallet, dhIdentity } = message;
            const { wallet: senderWallet } = transport.extractSenderInfo(request);
            const identity = transport.extractSenderID(request);

            if (senderWallet !== wallet) {
                logger.warn(`Wallet in the message differs from replication request for offer ID ${offerId}.`);
            }

            await dcService.handleReplicationRequest(offerId, wallet, identity, dhIdentity);
        });

        // async
        this._on('kad-replication-finished', async (request, response) => {
            await transport.sendResponse(response, {
                status: 'OK',
            });
            const dhNodeId = transport.extractSenderID(request);
            const replicationFinishedMessage = transport.extractMessage(request);
            const { wallet } = transport.extractSenderInfo(request);
            const { offerId, messageSignature, dhIdentity } = replicationFinishedMessage;
            await dcService.verifyDHReplication(
                offerId, messageSignature,
                dhNodeId, dhIdentity, wallet,
            );
        });

        // sync
        // TODO this call should be refactored to be async
        this._on('kad-challenge-request', async (request, response) => {
            try {
                const message = transport.extractMessage(request);
                logger.info(`Challenge arrived: Block ID ${message.payload.block_id}, Import ID ${message.payload.import_id}`);
                const challenge = message.payload;

                let vertices = await this.graphStorage.findVerticesByImportId(challenge.import_id);
                ImportUtilities.unpackKeys(vertices, []);
                ImportUtilities.sort(vertices);
                // filter CLASS vertices
                vertices = vertices.filter(vertex => vertex.vertex_type !== 'CLASS'); // Dump class objects.
                const answer = Challenge.answerTestQuestion(challenge.block_id, vertices, 32);
                logger.trace(`Sending answer to question for import ID ${challenge.import_id}, block ID ${challenge.block_id}. Block ${answer}`);

                try {
                    await transport.sendResponse(response, {
                        status: 'success',
                        answer,
                    });
                } catch (e) {
                    // TODO handle this case
                    logger.error(`Failed to send challenge response for import ${challenge.import_id}. Error: ${e}.`);
                }
            } catch (error) {
                logger.error(`Failed to get data. ${error}.`);
                notifyError(error);

                try {
                    await transport.sendResponse(response, {
                        status: 'fail',
                    });
                } catch (e) {
                    // TODO handle this case
                    logger.error(`Failed to send response 'fail' status. Error: ${e}.`);
                }
            }
        });

        // async
        this._on('kad-data-location-response', async (request, response) => {
            await transport.sendResponse(response, {
                status: 'OK',
            });
            logger.info('DH confirms possesion of required data');
            try {
                const dataLocationResponseObject = transport.extractMessage(request);
                const { message, messageSignature } = dataLocationResponseObject;

                if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                    const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                    logger.warn(returnMessage);
                    return;
                }

                await dvController.handleDataLocationResponse(message);
            } catch (error) {
                logger.error(`Failed to process location response. ${error}.`);
                notifyError(error);
            }
        });

        // async
        this._on('kad-data-read-request', async (request, response) => {
            await transport.sendResponse(response, {
                status: 'OK',
            });
            logger.info('Request for data read received');

            const dataReadRequestObject = transport.extractMessage(request);
            const { message, messageSignature } = dataReadRequestObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                logger.warn(returnMessage);
                return;
            }
            await dhService.handleDataReadRequestFree(message);
        });

        // async
        this._on('kad-data-read-response', async (request, response) => {
            await transport.sendResponse(response, {
                status: 'OK',
            });
            logger.info('Encrypted data received');

            const reqStatus = transport.extractRequestStatus(request);
            const reqMessage = transport.extractMessage(request);
            if (reqStatus === 'FAIL') {
                logger.warn(`Failed to send data-read-request. ${reqMessage}`);
                return;
            }
            const dataReadResponseObject = reqMessage;
            const { message, messageSignature } = dataReadResponseObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message}`);
                return;
            }

            try {
                await dvController.handleDataReadResponseFree(message);
            } catch (error) {
                logger.warn(`Failed to process data read response. ${error}.`);
                notifyError(error);
            }
        });

        // async
        this._on('kad-send-encrypted-key', async (request, response) => {
            await transport.sendResponse(response, {
                status: 'OK',
            });
            logger.info('Initial info received to unlock data');

            const encryptedPaddedKeyObject = transport.extractMessage(request);
            const { message, messageSignature } = encryptedPaddedKeyObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message}`);
                return;
            }

            const senderId = transport.extractSenderID();
            try {
                await dvService.handleEncryptedPaddedKey(message);
                await transport.sendEncryptedKeyProcessResult({
                    status: 'SUCCESS',
                }, senderId);
            } catch (error) {
                const errorMessage = `Failed to process encrypted key response. ${error}.`;
                logger.warn(errorMessage);
                notifyError(error);
                await transport.sendEncryptedKeyProcessResult({
                    status: 'FAIL',
                    message: error.message,
                }, senderId);
            }
        });

        // async
        this._on('kad-encrypted-key-process-result', async (request, response) => {
            await transport.sendResponse(response, {
                status: 'OK',
            });
            const senderId = transport.extractSenderID(request);
            const { status } = transport.extractMessage(request);
            if (status === 'SUCCESS') {
                logger.notify(`DV ${senderId} successfully processed the encrypted key`);
            } else {
                logger.notify(`DV ${senderId} failed to process the encrypted key`);
            }
        });
    }

    /**
     * Initializes internal emitter
     * @private
     */
    _initializeInternalEmitter() {
        const {
            dcService,
        } = this.ctx;

        this._on('int-miner-solution', async (err, data) => {
            if (err) {
                await dcService.miningFailed(data.offerId);
            } else {
                await dcService.miningSucceed(data);
            }
        });
    }

    /**
     * Emits event via appropriate event emitter
     */
    emit(event, ...args) {
        this._getEmitter(event).emit(event, ...args);
    }
}

module.exports = EventEmitter;

