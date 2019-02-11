const bytes = require('utf8-length');
const events = require('events');

const Utilities = require('./Utilities');
const Models = require('../models');
const ImportUtilities = require('./ImportUtilities');
const ObjectValidator = require('./validator/object-validator');

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
            commandExecutor,
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
                datasets: JSON.parse(response.imports),
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
            const { data_set_id: dataSetId } = data;
            logger.info(`Get vertices trigered for data-set ID ${dataSetId}`);
            try {
                const result = await dhService.getImport(dataSetId);

                if (result.vertices.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }

                const normalizedImport = ImportUtilities
                    .normalizeImport(dataSetId, result.vertices, result.edges);


                data.response.send(normalizedImport);
            } catch (error) {
                logger.error(`Failed to get vertices for data-set ID ${dataSetId}.`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            }
        });

        this._on('api-consensus-events', async (data) => {
            const { sender_id, response } = data;
            try {
                const events = await this.graphStorage.getConsensusEvents(sender_id);
                data.response.send({
                    events,
                });
            } catch (err) {
                console.log(err);
                response.status(400);
                response.send({ message: 'Bad Request' });
            }
        });

        this._on('api-import-info', async (data) => {
            const { dataSetId } = data;
            logger.info(`Get imported vertices triggered for import ID ${dataSetId}`);
            try {
                const dataInfo =
                    await Models.data_info.findOne({ where: { data_set_id: dataSetId } });

                if (!dataInfo) {
                    logger.info(`Import data for data set ID ${dataSetId} does not exist.`);
                    data.response.status(404);
                    data.response.send({
                        message: `Import data for data set ID ${dataSetId} does not exist`,
                    });
                    return;
                }

                const result = await dhService.getImport(dataSetId);

                // Check if packed to fix issue with double classes.
                const filtered = result.vertices.filter(v => v._dc_key);
                if (filtered.length > 0) {
                    result.vertices = filtered;
                    ImportUtilities.unpackKeys(result.vertices, result.edges);
                }

                if (result.vertices.length === 0) {
                    data.response.status(204);
                    data.response.send(result);
                } else {
                    const transactionHash = await ImportUtilities
                        .getTransactionHash(dataSetId, dataInfo.origin);

                    data.response.status(200);
                    data.response.send({
                        import: ImportUtilities.normalizeImport(
                            dataSetId,
                            result.vertices,
                            result.edges,
                        ),
                        root_hash: dataInfo.root_hash,
                        transaction: transactionHash,
                        data_provider_wallet: dataInfo.data_provider_wallet,
                    });
                }
            } catch (error) {
                logger.error(`Failed to get vertices for data set ID ${dataSetId}. ${error}.${error.stack}`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: error.toString(),
                });
            }
        });

        this._on('api-imports-info', async (data) => {
            logger.debug('Get import ids');
            try {
                const dataimports = await Models.data_info.findAll();
                data.response.status(200);
                const promises = dataimports.map(async di => ({
                    data_set_id: di.data_set_id,
                    total_documents: di.total_documents,
                    root_hash: di.root_hash,
                    data_size: di.data_size,
                    transaction_hash: await ImportUtilities
                        .getTransactionHash(di.data_set_id, di.origin),
                    data_provider_wallet: di.data_provider_wallet,
                }));
                data.response.send(await Promise.all(promises));
            } catch (e) {
                logger.error('Failed to get information about imports', e);
                data.response.status(500);
                data.response.send({
                    message: 'Failed to get information about imports',
                });
            }
        });

        this._on('api-query', (data) => {
            logger.info(`Get vertices triggered with query ${JSON.stringify(data.query)}`);
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

            dvController.queryNetwork(data.query)
                .then((queryId) => {
                    data.response.status(201);
                    data.response.send({
                        message: 'Query sent successfully.',
                        query_id: queryId,
                    });
                }).catch((error) => {
                    logger.error(`Failed query network. ${error}.`);
                    notifyError(error);
                });
        });

        this._on('api-choose-offer', async (data) => {
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
                const message = `Failed to handle offer ${offer.id} for query ${offer.query_id} handled. ${e}.`;
                data.response.status(500);
                data.response.send({ message });
                failFunction(message);
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

                if (error.type !== 'ImporterError') {
                    notifyError(error);
                }
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
                        origin: 'IMPORTED',
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
            const { replicationId } = data;
            logger.info(`Offer status for internal ID ${replicationId} triggered.`);
            const offer = await Models.offers.findOne({ where: { id: replicationId } });
            if (offer) {
                data.response.status(200);
                data.response.send({
                    status: offer.status,
                    message: offer.message,
                    offer_id: offer.offer_id,
                });
            } else {
                logger.error(`There is no offer for interanl ID ${replicationId}`);
                data.response.status(404);
                data.response.send({
                    message: 'Replication not found',
                });
            }
        });

        this._on('api-payout', async (data) => {
            const { offerId } = data;

            logger.info(`Payout called for offer ${offerId}.`);
            const bid = await Models.bids.findOne({ where: { offer_id: offerId } });
            if (bid) {
                await commandExecutor.add({
                    name: 'dhPayOutCommand',
                    delay: 0,
                    data: {
                        offerId,
                    },
                });

                data.response.status(200);
                data.response.send({
                    message: `Payout for offer ${offerId} called. It should be completed shortly.`,
                });
            } else {
                logger.error(`There is no offer for ID ${offerId}`);
                data.response.status(404);
                data.response.send({
                    message: 'Offer not found',
                });
            }
        });

        this._on('api-create-offer', async (data) => {
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
                    data.response.status(404);
                    data.response.send({
                        message: 'This data set does not exist in the database',
                    });
                    return;
                }

                if (dataSizeInBytes == null) {
                    dataSizeInBytes = dataset.data_size;
                }

                if (dataRootHash == null) {
                    dataRootHash = dataset.root_hash;
                }

                const replicationId = await dcService.createOffer(
                    dataSetId, dataRootHash, holdingTimeInMinutes, tokenAmountPerHolder,
                    dataSizeInBytes, litigationIntervalInMinutes,
                );

                data.response.status(201);
                data.response.send({
                    replication_id: replicationId,
                    data_set_id: dataSetId,
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

        this._on('api-withdraw-tokens', async (data) => {
            const { trac_amount } = data;

            try {
                logger.info(`Withdraw ${trac_amount} TRAC to wallet triggered`);

                await profileService.withdrawTokens(trac_amount);

                data.response.status(200);
                data.response.send({
                    message: `Withdraw operation started for amount ${trac_amount}.`,
                });
                // TODO notify Houston
                // remoteControl.tokensWithdrawSucceeded
                // (`Successfully withdrawn ${trac_amount} TRAC`);
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
            approvalService,
            logger,
        } = this.ctx;

        this._on('eth-NodeApproved', (eventData) => {
            const {
                nodeId,
            } = eventData;

            try {
                approvalService.addApprovedNode(nodeId);
            } catch (e) {
                logger.warn(e.message);
            }
        });

        this._on('eth-NodeRemoved', (eventData) => {
            const {
                nodeId,
            } = eventData;

            try {
                approvalService.removeApprovedNode(nodeId);
            } catch (e) {
                logger.warn(e.message);
            }
        });

        this._on('eth-OfferCreated', async (eventData) => {
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
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message.toString()}`);
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

        // sync
        this._on('kad-replication-request', async (request, response) => {
            const message = transport.extractMessage(request);
            const { offerId, wallet, dhIdentity } = message;
            const { wallet: senderWallet } = transport.extractSenderInfo(request);
            const identity = transport.extractSenderID(request);

            if (senderWallet !== wallet) {
                logger.warn(`Wallet in the message differs from replication request for offer ID ${offerId}.`);
            }

            try {
                await dcService.handleReplicationRequest(
                    offerId, wallet, identity, dhIdentity,
                    response,
                );
            } catch (error) {
                const errorMessage = `Failed to handle replication request. ${error}.`;
                logger.warn(errorMessage);
                notifyError(error);

                try {
                    await transport.sendResponse(response, {
                        status: 'fail',
                    });
                } catch (e) {
                    logger.error(`Failed to send response 'fail' status. Error: ${e}.`); // TODO handle this case
                }
            }
        });

        // sync
        this._on('kad-replacement-replication-request', async (request, response) => {
            try {
                const message = transport.extractMessage(request);
                const { offerId, wallet, dhIdentity } = message;
                const { wallet: senderWallet } = transport.extractSenderInfo(request);
                const identity = transport.extractSenderID(request);

                if (senderWallet !== wallet) {
                    logger.warn(`Wallet in the message differs from replacement replication request for offer ID ${offerId}.`);
                }

                await dcService.handleReplacementRequest(
                    offerId, wallet, identity, dhIdentity,
                    response,
                );
            } catch (error) {
                const errorMessage = `Failed to handle replacement replication request. ${error}.`;
                logger.warn(errorMessage);
                notifyError(error);

                try {
                    await transport.sendResponse(response, {
                        status: 'fail',
                    });
                } catch (e) {
                    logger.error(`Failed to send response 'fail' status. Error: ${e}.`); // TODO handle this case
                }
            }
        });

        // async
        this._on('kad-replication-finished', async (request) => {
            try {
                const dhNodeId = transport.extractSenderID(request);
                const replicationFinishedMessage = transport.extractMessage(request);
                const { wallet } = transport.extractSenderInfo(request);
                const { offerId, messageSignature, dhIdentity } = replicationFinishedMessage;
                await dcService.verifyDHReplication(
                    offerId, messageSignature,
                    dhNodeId, dhIdentity, wallet, false,
                );
            } catch (e) {
                const errorMessage = `Failed to handle replication finished request. ${e}.`;
                logger.warn(errorMessage);
                notifyError(e);
            }
        });

        // async
        this._on('kad-replacement-replication-finished', async (request) => {
            try {
                const dhNodeId = transport.extractSenderID(request);
                const replicationFinishedMessage = transport.extractMessage(request);
                const { wallet } = transport.extractSenderInfo(request);
                const { offerId, messageSignature, dhIdentity } = replicationFinishedMessage;
                await dcService.verifyDHReplication(
                    offerId, messageSignature,
                    dhNodeId, dhIdentity, wallet, true,
                );
            } catch (e) {
                const errorMessage = `Failed to handle replacement replication finished request. ${e}.`;
                logger.warn(errorMessage);
                notifyError(e);
            }
        });

        // async
        this._on('kad-challenge-request', async (request) => {
            try {
                const message = transport.extractMessage(request);
                const error = ObjectValidator.validateChallengeRequest(message);
                if (error) {
                    logger.trace(`Challenge request message is invalid. ${error.message}`);
                    return;
                }
                await dhService.handleChallenge(
                    message.payload.data_set_id,
                    message.payload.block_id,
                    message.payload.challenge_id,
                    message.payload.litigator_id,
                );
            } catch (error) {
                logger.error(`Failed to get data. ${error}.`);
                notifyError(error);
            }
        });

        // async
        this._on('kad-challenge-response', async (request) => {
            try {
                const message = transport.extractMessage(request);
                const error = ObjectValidator.validateChallengeResponse(message);
                if (error) {
                    logger.trace(`Challenge response message is invalid. ${error.message}`);
                    return;
                }

                await dcService.handleChallengeResponse(
                    message.payload.challenge_id,
                    message.payload.answer,
                );
            } catch (error) {
                logger.error(`Failed to get data. ${error}.`);
                notifyError(error);
            }
        });

        // async
        this._on('kad-data-location-response', async (request) => {
            logger.info('DH confirms possession of required data');
            try {
                const dataLocationResponseObject = transport.extractMessage(request);
                const { message, messageSignature } = dataLocationResponseObject;

                if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                    const returnMessage = `We have a forger here. Signature doesn't match for message: ${message.toString()}`;
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
        this._on('kad-data-read-request', async (request) => {
            logger.info('Request for data read received');

            const dataReadRequestObject = transport.extractMessage(request);
            const { message, messageSignature } = dataReadRequestObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message.toString()}`);
                const returnMessage = `We have a forger here. Signature doesn't match for message: ${message.toString()}`;
                logger.warn(returnMessage);
                return;
            }
            await dhService.handleDataReadRequestFree(message);
        });

        // async
        this._on('kad-data-read-response', async (request) => {
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
                console.log('kad-data-read-response', JSON.stringify(message), JSON.stringify(messageSignature));
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message.toString()}`);
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
            await transport.sendResponse(response, []);
            logger.info('Initial info received to unlock data');

            const encryptedPaddedKeyObject = transport.extractMessage(request);
            const { message, messageSignature } = encryptedPaddedKeyObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message.toString()}`);
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
            await transport.sendResponse(response, []);
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

