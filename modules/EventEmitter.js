const bytes = require('utf8-length');
const events = require('events');

const Utilities = require('./Utilities');
const Models = require('../models');
const ImportUtilities = require('./ImportUtilities');
const ObjectValidator = require('./validator/object-validator');
const { sha3_256 } = require('js-sha3');

class EventEmitter {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.product = ctx.product;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
        this.appState = ctx.appState;
        this.importService = ctx.importService;
        this.epcisOtJsonTranspiler = ctx.epcisOtJsonTranspiler;
        this.wotOtJsonTranspiler = ctx.wotOtJsonTranspiler;
        this.commandExecutor = ctx.commandExecutor;

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
            blockchain,
            product,
            logger,
            remoteControl,
            config,
            appState,
            profileService,
            dcService,
            dvController,
            commandExecutor,
            dhController,
        } = this.ctx;

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
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            });
        });

        this._on('api-trail-entity', (data) => {
            logger.info(`Get enitity trail triggered with query ${JSON.stringify(data.query)}`);

            this.graphStorage
                .findEntitiesTraversalPath(
                    data.query.startVertex,
                    data.query.depth,
                    data.query.includeOnly,
                    data.query.excludeOnly,
                ).then((res) => {
                    if (res.length === 0) {
                        data.response.status(204);
                    } else {
                        data.response.status(200);
                    }
                    data.response.send(res);
                }).catch((error) => {
                    logger.error(`Failed to get trail for query ${JSON.stringify(data.query)}`);
                    data.response.status(500);
                    data.response.send({
                        message: error,
                    });
                });
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

        this._on('api-query-local-import', async (data) => {
            const { data_set_id: dataSetId, format, encryption } = data;
            logger.info(`Get vertices trigered for data-set ID ${dataSetId}`);
            try {
                const datasetOtJson = await this.importService.getImport(dataSetId, encryption);

                if (datasetOtJson == null) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }

                let formattedDataset = '';

                if (datasetOtJson == null) {
                    data.response.status(204);
                    data.response.send({});
                } else if (encryption == null) {
                    switch (format) {
                    case 'otjson':
                        formattedDataset = datasetOtJson;
                        break;
                    case 'epcis':
                        formattedDataset = this.epcisOtJsonTranspiler
                            .convertFromOTJson(datasetOtJson);
                        break;
                    default:
                        throw Error('Invalid response format.');
                    }
                    data.response.send(formattedDataset);
                } else {
                    data.response.send(formattedDataset);
                }
            } catch (error) {
                logger.error(`Failed to get vertices for data-set ID ${dataSetId}.`);
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
                const promises = dataimports.map(async di => ({
                    data_set_id: di.data_set_id,
                    total_documents: di.total_documents,
                    root_hash: di.root_hash,
                    data_size: di.data_size,
                    replication_info: await ImportUtilities
                        .getReplicationInfo(di.data_set_id, di.origin),
                    data_provider_wallets: JSON.parse(di.data_provider_wallets),
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
                logger.error(`There is no offer for internal ID ${replicationId}`);
                data.response.status(404);
                data.response.send({
                    message: 'Replication not found',
                });
            }
        });

        this._on('api-payout', async (data) => {
            const { offerId, urgent } = data;

            logger.info(`Payout called for offer ${offerId}.`);
            const bid = await Models.bids.findOne({ where: { offer_id: offerId } });
            if (bid) {
                await profileService.payOut(offerId, urgent, bid.dataValues.blockchain_id);

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

        this._on('api-import-info', async (data) => {
            const { dataSetId, responseFormat } = data;
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

                const datasetOtJson = await this.importService.getImport(dataSetId);
                let formattedDataset = null;

                if (datasetOtJson == null) {
                    data.response.status(204);
                    data.response.send({});
                } else {
                    switch (responseFormat) {
                    case 'otjson': formattedDataset = datasetOtJson; break;
                    case 'epcis': formattedDataset = this.epcisOtJsonTranspiler.convertFromOTJson(datasetOtJson); break;
                    default: throw Error('Invalid response format.');
                    }

                    const replicationInfo = await ImportUtilities
                        .getReplicationInfo(dataSetId, dataInfo.origin);

                    data.response.status(200);
                    data.response.send({
                        dataSetId,
                        document: formattedDataset,
                        root_hash: dataInfo.root_hash,
                        data_provider_wallets: JSON.parse(dataInfo.data_provider_wallets),
                        replication_info: replicationInfo,
                    });
                }
            } catch (error) {
                logger.error(`Failed to get vertices for data set ID ${dataSetId}. ${error}.${error.stack}`);
                data.response.status(500);
                data.response.send({
                    message: error.toString(),
                });
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
                blockchain_id,
            } = eventData;

            try {
                await dhService.handleOffer(
                    offerId, dcNodeId,
                    dataSetSizeInBytes, holdingTimeInMinutes, litigationIntervalInMinutes,
                    tokenAmountPerHolder, dataSetId, blockchain_id,
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
            dcController,
            dhController,
            networkService,
        } = this.ctx;

        // sync
        this._on('kad-join', async (request, response) => {
            await transport.sendResponse(response, await transport.join());
        });

        this._on('kad-data-location-request', async (request) => {
            const { message, messageSignature } = request;
            if (ObjectValidator.validateSearchQueryObject(message.query)) {
                return;
            }
            logger.info(`Request for data ${message.query[0].value} from DV ${message.wallet} received`);

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
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
            }
        });

        this._on('kad-purchase-complete', async (request) => {
            const { message, messageSignature } = request;

            logger.info(`Purchase confirmation from DV ${message.seller_node_id} received`);

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }

            try {
                const {
                    purchase_id,
                    blockchain_id,
                    data_set_id,
                    ot_object_id,
                    seller_node_id,
                    seller_erc_ids,
                    prices,
                } = message;
                await dvController.handleNewDataSeller(
                    purchase_id, blockchain_id, seller_erc_ids, seller_node_id,
                    data_set_id, ot_object_id, prices,
                );
            } catch (error) {
                const errorMessage = `Failed to process purchase completion message. ${error}.`;
                logger.warn(errorMessage);
            }
        });

        // sync
        this._on('kad-replication-request', async (request, response) => {
            const kadReplicationRequest = transport.extractMessage(request);
            var replicationMessage = kadReplicationRequest;
            if (kadReplicationRequest.messageSignature) {
                const { message, messageSignature } = kadReplicationRequest;
                replicationMessage = message;

                if (!Utilities.isMessageSigned(message, messageSignature)) {
                    logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                    return;
                }
            }

            const {
                offerId, wallet, dhIdentity, async_enabled,
            } = replicationMessage;
            const identity = transport.extractSenderID(request);
            try {
                await dcService.handleReplicationRequest(
                    offerId, wallet, identity, dhIdentity, async_enabled,
                    response,
                );
            } catch (error) {
                const errorMessage = `Failed to handle replication request. ${error}.`;
                logger.warn(errorMessage);

                try {
                    await transport.sendResponse(response, {
                        status: 'fail',
                    });
                } catch (e) {
                    logger.error(`Failed to send response 'fail' status. Error: ${e}.`); // TODO handle this case
                }
            }
        });

        this._on('kad-replication-data', async (request, response) => {
            const kadReplicationRequest = transport.extractMessage(request);
            let replicationMessage = kadReplicationRequest;

            if (kadReplicationRequest.messageSignature) {
                const { message, messageSignature } = kadReplicationRequest;
                replicationMessage = message;

                if (!Utilities.isMessageSigned(message, messageSignature)) {
                    logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                    return;
                }
            }

            const senderIdentity = transport.extractSenderID(request);
            try {
                await dhController.handleReplicationData(
                    senderIdentity,
                    replicationMessage,
                    response,
                );
            } catch (error) {
                const errorMessage = `Failed to handle replication data. ${error}.`;
                logger.warn(errorMessage);

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
                const {
                    offerId, wallet, dhIdentity,
                    async_enabled,
                } = message;
                const { wallet: senderWallet } = transport.extractSenderInfo(request);
                const identity = transport.extractSenderID(request);

                if (senderWallet !== wallet) {
                    logger.warn(`Wallet in the message differs from replacement replication request for offer ID ${offerId}.`);
                }

                await dcService.handleReplacementRequest(
                    offerId, wallet, identity, dhIdentity, async_enabled,
                    response,
                );
            } catch (error) {
                const errorMessage = `Failed to handle replacement replication request. ${error}.`;
                logger.warn(errorMessage);

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

                let dhWallet = replicationFinishedMessage.wallet;
                if (!dhWallet) {
                    dhWallet = transport.extractSenderInfo(request).wallet;
                }

                if (replicationFinishedMessage.message) { // todo remove if for next update
                    const {
                        message, messageSignature,
                    } = replicationFinishedMessage;
                    if (!Utilities.isMessageSigned(message, messageSignature)) {
                        logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                        return;
                    }

                    await dcService.verifyDHReplication(
                        message.offerId, messageSignature,
                        dhNodeId, message.dhIdentity, dhWallet, false,
                    );
                }

                const {
                    offerId, messageSignature, dhIdentity,
                } = replicationFinishedMessage;

                await dcService.verifyDHReplication(
                    offerId, messageSignature,
                    dhNodeId, dhIdentity, dhWallet, false,
                );
            } catch (e) {
                const errorMessage = `Failed to handle replication finished request. ${e}.`;
                logger.warn(errorMessage);
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
            }
        });

        // async
        this._on('kad-challenge-request', async (request) => {
            try {
                const challengeRequest = transport.extractMessage(request);
                let message = challengeRequest;
                if (challengeRequest.messageSignature) {
                    // eslint-disable-next-line prefer-destructuring
                    message = challengeRequest.message;
                }

                const error = ObjectValidator.validateChallengeRequest(message);
                if (error) {
                    logger.trace(`Challenge request message is invalid. ${error.message}`);
                    return;
                }
                if (challengeRequest.messageSignature) { // todo remove if for next update
                    const { messageSignature } = challengeRequest;
                    if (!Utilities.isMessageSigned(message, messageSignature)) {
                        logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                        return;
                    }

                    await dhService.handleChallenge(
                        message.data_set_id,
                        message.offer_id,
                        message.object_index,
                        message.block_index,
                        message.challenge_id,
                        message.litigator_id,
                    );
                    return;
                }
                await dhService.handleChallenge(
                    message.payload.data_set_id,
                    message.payload.offer_id,
                    message.payload.object_index,
                    message.payload.block_index,
                    message.payload.challenge_id,
                    message.payload.litigator_id,
                );
            } catch (error) {
                logger.error(`Failed to get data. ${error}.`);
            }
        });

        // async
        this._on('kad-challenge-response', async (request) => {
            try {
                const challengeResponse = transport.extractMessage(request);
                let message = challengeResponse;
                if (challengeResponse.messageSignature) {
                    // eslint-disable-next-line prefer-destructuring
                    message = challengeResponse.message;
                }
                const error = ObjectValidator.validateChallengeResponse(message);
                if (error) {
                    logger.trace(`Challenge response message is invalid. ${error.message}`);
                    return;
                }

                if (challengeResponse.messageSignature) { // todo remove if for next update
                    const { messageSignature } = challengeResponse;
                    if (!Utilities.isMessageSigned(message, messageSignature)) {
                        logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                        return;
                    }

                    await dcService.handleChallengeResponse(
                        message.data_set_id,
                        message.answer,
                    );
                    return;
                }

                await dcService.handleChallengeResponse(
                    message.payload.challenge_id,
                    message.payload.answer,
                );
            } catch (error) {
                logger.error(`Failed to get data. ${error}.`);
            }
        });

        // async
        this._on('kad-data-location-response', async (request) => {
            logger.info('DH confirms possession of required data');
            try {
                const dataLocationResponseObject = transport.extractMessage(request);
                const { message, messageSignature } = dataLocationResponseObject;

                if (!Utilities.isMessageSigned(message, messageSignature)) {
                    const returnMessage = `We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`;
                    logger.warn(returnMessage);
                    return;
                }

                await dvController.handleDataLocationResponse(message);
            } catch (error) {
                logger.error(`Failed to process location response. ${error}.`);
            }
        });

        // async
        this._on('kad-data-read-request', async (request) => {
            logger.info('Request for data read received');

            const dataReadRequestObject = transport.extractMessage(request);
            const { message, messageSignature } = dataReadRequestObject;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                const returnMessage = `We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`;
                logger.warn(returnMessage);
                return;
            }
            await this.commandExecutor.add({
                name: 'dhDataReadRequestFreeCommand',
                transactional: false,
                data: {
                    message,
                },
            });
        });

        // async
        this._on('kad-data-read-response', async (request) => {
            logger.info('Received data read response');

            const reqStatus = transport.extractRequestStatus(request);
            const reqMessage = transport.extractMessage(request);
            if (reqStatus === 'FAIL') {
                logger.warn(`Failed to send data-read-request. ${reqMessage}`);
                return;
            }
            const dataReadResponseObject = reqMessage;
            const { message, messageSignature } = dataReadResponseObject;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                console.log('kad-data-read-response', JSON.stringify(message), JSON.stringify(messageSignature));
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }

            try {
                await dvController.handleDataReadResponseFree(message);
            } catch (error) {
                logger.warn(`Failed to process data read response. ${error}.`);
            }
        });

        this._on('kad-permissioned-data-read-request', async (request) => {
            logger.info('Request for permissioned data read received');
            const dataReadRequestObject = transport.extractMessage(request);
            const { message, messageSignature } = dataReadRequestObject;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }
            try {
                await dcController.handlePermissionedDataReadRequest(message);
            } catch (error) {
                logger.warn(`Failed to process permissioned data read request. ${error}.`);
                // todo send error to dv
            }
        });

        this._on('kad-permissioned-data-read-response', async (request) => {
            logger.info('Response for permissioned data read received');

            const dataReadRequestObject = transport.extractMessage(request);
            const { message, messageSignature } = dataReadRequestObject;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }
            try {
                await dvController.handlePermissionedDataReadResponse(message);
            } catch (error) {
                logger.warn(`Failed to process permissioned data read response. ${error}.`);
            }
        });

        // async
        this._on('kad-data-purchase-request', async (request) => {
            logger.info('Data purchase received');
            const dvNodeId = transport.extractSenderID(request);
            const reqStatus = transport.extractRequestStatus(request);
            const reqMessage = transport.extractMessage(request);
            if (reqStatus === 'FAIL') {
                logger.warn(`Failed to send data-purchase-request. ${reqMessage}`);
                return;
            }
            const { message, messageSignature } = reqMessage;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }

            try {
                message.dv_node_id = dvNodeId;
                await dcController.handleNetworkPurchaseRequest(message);
            } catch (error) {
                logger.warn(`Failed to process data purchase request. ${error}.`);
            }
        });

        // async
        this._on('kad-data-purchase-response', async (request) => {
            logger.info('Received purchase response');

            const reqStatus = transport.extractRequestStatus(request);
            const reqMessage = transport.extractMessage(request);
            if (reqStatus === 'FAIL') {
                logger.warn(`Failed to send data-purchase-response. ${reqMessage}`);
                return;
            }
            const { message, messageSignature } = reqMessage;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }

            try {
                await dvController.handleNetworkPurchaseResponse(message);
            } catch (error) {
                logger.warn(`Failed to process data purchase response. ${error}.`);
            }
        });


        // async
        this._on('kad-data-price-request', async (request) => {
            logger.info('Data price request received');
            const dvNodeId = transport.extractSenderID(request);
            const reqStatus = transport.extractRequestStatus(request);
            const reqMessage = transport.extractMessage(request);
            if (reqStatus === 'FAIL') {
                logger.warn(`Failed to send data-price-request. ${reqMessage}`);
                return;
            }
            const { message, messageSignature } = reqMessage;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }

            try {
                message.dv_node_id = dvNodeId;
                await dcController.handleNetworkPriceRequest(message);
            } catch (error) {
                logger.warn(`Failed to process data price request. ${error}.`);
            }
        });

        // async
        this._on('kad-data-price-response', async (request) => {
            logger.info('Received price response');

            const reqStatus = transport.extractRequestStatus(request);
            const reqMessage = transport.extractMessage(request);
            if (reqStatus === 'FAIL') {
                logger.warn(`Failed to send data-price-response. ${reqMessage}`);
                return;
            }
            const { message, messageSignature } = reqMessage;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }

            try {
                await dvController.handlePermissionedDataPriceResponse(message);
            } catch (error) {
                logger.warn(`Failed to process data price response. ${error}.`);
            }
        });

        // async
        this._on('kad-send-encrypted-key', async (request, response) => {
            await transport.sendResponse(response, []);
            logger.info('Initial info received to unlock data');

            const encryptedPaddedKeyObject = transport.extractMessage(request);
            const { message, messageSignature } = encryptedPaddedKeyObject;

            if (!Utilities.isMessageSigned(message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${JSON.stringify(message)}`);
                return;
            }

            const senderId = transport.extractSenderID();
            try {
                await transport.sendEncryptedKeyProcessResult({
                    status: 'SUCCESS',
                }, senderId);
            } catch (error) {
                const errorMessage = `Failed to process encrypted key response. ${error}.`;
                logger.warn(errorMessage);
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

        // async
        this._on('kad-public-key-request', async (request, response) => {
            logger.info('Public key request received');

            const publicKeyData = networkService.getPublicKeyData();
            try {
                await transport.sendResponse(response, publicKeyData);
            } catch (error) {
                const errorMessage = `Failed to send public key data. ${error}.`;
                logger.warn(errorMessage);
                await transport.sendResponse(response, {
                    status: 'FAIL',
                    message: error.message,
                });
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
                await dcService.miningFailed(err);
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

