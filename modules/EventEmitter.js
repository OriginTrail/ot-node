const Graph = require('./Graph');
const Challenge = require('./Challenge');
const Utilities = require('./Utilities');
const config = require('./Config');
const Models = require('../models');
const Op = require('sequelize/lib/operators');
const Encryption = require('./Encryption');
const ImportUtilities = require('./ImportUtilities');

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
        this.globalEmitter = new events.EventEmitter();
    }

    /**
     * Initializes event listeners
     */
    initialize() {
        const {
            dcService,
            dhService,
            dvService,
            dataReplication,
            importer,
            challenger,
            blockchain,
            product,
            logger,
            graph,
        } = this.ctx;

        this.globalEmitter.on('trail', (data) => {
            product.getTrailByQuery(data.query).then((res) => {
                data.response.send(res);
            }).catch(() => {
                logger.error(`Failed to get trail for query ${data.query}`);
                data.response.send(500); // TODO rethink about status codes
            });
        });

        this.globalEmitter.on('get_root_hash', (data) => {
            const dcWallet = data.query.dc_wallet;
            if (dcWallet == null) {
                data.response.send({
                    status: 400,
                    message: 'dc_wallet parameter query is missing',
                });
                return;
            }
            const importId = data.query.import_id;
            if (importId == null) {
                data.response.send({
                    status: 400,
                    message: 'import_id parameter query is missing',
                });
                return;
            }
            blockchain.getRootHash(dcWallet, importId).then((res) => {
                data.response.send(res);
            }).catch((err) => {
                logger.error(`Failed to get root hash for query ${data.query}`);
                data.response.send(500); // TODO rethink about status codes
            });
        });

        this.globalEmitter.on('network-query', (data) => {
            const failFunction = (error) => {
                logger.warn(error);
                data.response.send({
                    status: 'FAIL',
                    message: 'Failed to handle query',
                });
            };
            dvService.queryNetwork(data.query)
                .then((queryId) => {
                    data.response.send({
                        status: 'OK',
                        message: 'Query sent successfully.',
                        query_id: queryId,
                    });
                    dvService.handleQuery(queryId).then((offer) => {
                        if (offer) {
                            dvService.handleReadOffer(offer).then(() => {
                                logger.info(`Read offer ${offer.id} for query ${offer.query_id} initiated.`);
                            }).catch(err => failFunction(`Failed to handle offer ${offer.id} for query ${offer.query_id} handled. ${err}.`));
                        } else {
                            logger.info(`No offers for query ${offer.query_id} handled.`);
                        }
                    }).catch(error => logger.error(`Failed handle query. ${error}.`));
                }).catch(error => logger.error(`Failed query network. ${error}.`));
        });

        this.globalEmitter.on('network-query-status', async (data) => {
            const { id, response } = data;

            const networkQuery = await Models.network_queries.find({ where: { id } });
            if (networkQuery.status === 'FINISHED') {
                try {
                    const vertices = await dhService.dataLocationQuery(id);

                    response.send({
                        status: 'OK',
                        message: `Query status ${networkQuery.status}.`,
                        query_id: networkQuery.id,
                        vertices,
                    });
                } catch (error) {
                    logger.info(`Failed to process network query status for ID ${id}. ${error}.`);
                    response.send({
                        status: 'FAIL',
                        error: 'Fail to process.',
                        query_id: networkQuery.id,
                    });
                }
            } else {
                response.send({
                    status: 'OK',
                    message: `Query status ${networkQuery.status}.`,
                    query_id: networkQuery.id,
                });
            }
        });

        const processImport = async (response, error, data) => {
            if (response === null) {
                data.response.status(error.status);
                data.response.send({
                    status: error.status,
                    message: error.message,
                });
                return;
            }

            const {
                import_id,
                root_hash,
                total_documents,
                vertices,
                wallet,
            } = response;

            try {
                await Models.data_info
                    .create({
                        import_id, root_hash, import_timestamp: new Date(), total_documents,
                    }).catch((error) => {
                        logger.error(error);
                        data.response.send({
                            status: 500,
                            message: error,
                        });
                    });
                await dcService.createOffer(import_id, root_hash, total_documents, vertices);
            } catch (error) {
                logger.error(`Failed to start offer. Error ${error}.`);
                data.response.send({
                    status: 500,
                    message: 'Failed to parse XML.',
                });
                return;
            }

            data.response.send({
                status: 200,
                message: 'Ok.',
            });
        };

        this.globalEmitter.on('gs1-import-request', async (data) => {
            try {
                const responseObject = await importer.importXMLgs1(data.filepath);
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

        this.globalEmitter.on('wot-import-request', async (data) => {
            try {
                const responseObject = await importer.importWOT(data.filepath);
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

        this.globalEmitter.on('replication-request', async (request, response) => {
            logger.trace('replication-request received');

            const { import_id, wallet } = request.params.message;
            const { wallet: kadWallet } = request.contact[1];
            const kadIdentity = request.contact[0];

            if (!import_id || !wallet) {
                const errorMessage = 'Asked replication without providing import ID or wallet.';
                logger.warn(errorMessage);
                response.send({ status: 'fail', error: errorMessage });
                return;
            }

            if (kadWallet !== wallet) {
                logger.warn(`Wallet from KADemlia differs from replication request for import ID ${import_id}.`);
            }

            const offerModel = await Models.offers.findOne({ where: { id: import_id } });
            if (!offerModel) {
                const errorMessage = `Replication request for offer I don't know: ${import_id}.`;
                logger.warn(errorMessage);
                response.send({ status: 'fail', error: errorMessage });
                return;
            }

            const offer = offerModel.get({ plain: true });

            // Check is it valid ID of replicator.
            const offerDhIds = JSON.parse(offer.dh_ids);
            const offerWallets = JSON.parse(offer.dh_wallets);

            // TODO: Bids should -be stored for all predetermined and others and then checked here.
            // if (!offerDhIds.includes(kadIdentity) || !offerWallets.includes(kadWallet)) {
            //     const errorMessage = `Replication request for
            // offer you didn't apply: ${import_id}.`;
            //     logger.warn(`DH ${kadIdentity} requested data
            // without offer for import ID ${import_id}.`);
            //     response.send({ status: 'fail', error: errorMessage });
            //     return;
            // }

            const objectClassesPromise = this.graphStorage.findObjectClassVertices();
            const verticesPromise = this.graphStorage.findVerticesByImportId(offer.id);
            const edgesPromise = this.graphStorage.findEdgesByImportId(offer.id);

            const values = await Promise.all([verticesPromise, edgesPromise, objectClassesPromise]);
            let vertices = values[0];
            const edges = values[1];
            const objectClassVertices = values[2];

            vertices = vertices.concat(...objectClassVertices);

            for (const vertex of vertices) {
                delete vertex.imports;
                delete vertex.private;
            }

            const keyPair = Encryption.generateKeyPair();
            Graph.encryptVertices(vertices, keyPair.privateKey);

            const replicatedData = await Models.replicated_data.create({
                dh_id: kadIdentity,
                import_id,
                offer_id: offer.id,
                data_private_key: keyPair.privateKey,
                data_public_key: keyPair.publicKey,
                status: 'ACTIVE',
            });

            logger.info('[DC] Preparing to enter sendPayload');
            const data = {
                contact: kadIdentity,
                vertices,
                edges,
                import_id,
                public_key: keyPair.publicKey,
                root_hash: offer.data_hash,
                total_escrow_time: offer.total_escrow_time,
            };

            dataReplication.sendPayload(data).then(() => {
                logger.info(`[DC] Payload sent. Replication ID ${replicatedData.id}.`);
            }).catch((error) => {
                logger.warn(`Failed to send payload to ${kadIdentity}. Replication ID ${replicatedData.id}. ${error}`);
            });

            response.send({ status: 'success' });
        });

        this.globalEmitter.on('payload-request', async (request) => {
            logger.trace(`payload-request arrived from ${request.contact[0]}`);
            await dhService.handleImport(request.params.message.payload);

            // TODO doktor: send fail in case of fail.
        });

        this.globalEmitter.on('replication-finished', (status) => {
            logger.warn('Notified of finished replication, preparing to start challenges');
            challenger.startChallenging();
        });

        this.globalEmitter.on('kad-challenge-request', (request, response) => {
            logger.trace(`Challenge arrived: Block ID ${request.params.message.payload.block_id}, Import ID ${request.params.message.payload.import_id}`);
            const challenge = request.params.message.payload;

            this.graphStorage.findVerticesByImportId(challenge.import_id).then((vertices) => {
                ImportUtilities.sort(vertices);
                // filter CLASS vertices
                vertices = vertices.filter(vertex => vertex.vertex_type !== 'CLASS'); // Dump class objects.
                const answer = Challenge.answerTestQuestion(challenge.block_id, vertices, 32);
                logger.trace(`Sending answer to question for import ID ${challenge.import_id}, block ID ${challenge.block_id}. Block ${answer}`);
                response.send({
                    status: 'success',
                    answer,
                }, (error) => {
                    logger.error(`Failed to send challenge answer to ${challenge.import_id}. Error: ${error}.`);
                });
            }).catch((error) => {
                logger.error(`Failed to get data. ${error}.`);

                response.send({
                    status: 'fail',
                }, (error) => {
                    logger.error(`Failed to send 'fail' status.v Error: ${error}.`);
                });
            });
        });

        /**
         * Handles bidding-broadcast on the DH side
         */
        this.globalEmitter.on('kad-data-location-request', async (kadMessage) => {
            logger.info('kad-data-location-request received');

            const dataLocationRequestObject = kadMessage;
            const { message, messageSignature } = dataLocationRequestObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message}`);
                return;
            }

            try {
                await dhService.handleDataLocationRequest(message);
            } catch (error) {
                const errorMessage = `Failed to process data location request. ${error}.`;
                logger.warn(errorMessage);
            }
        });

        this.globalEmitter.on('offer-ended', (message) => {
            const { scId } = message;

            logger.info(`Offer ${scId} has ended.`);
        });

        this.globalEmitter.on('AddedBid', (message) => {

        });

        this.globalEmitter.on('kad-bidding-won', (message) => {
            logger.info('Wow I won bidding. Let\'s get into it.');
        });

        this.globalEmitter.on('eth-OfferCreated', async (eventData) => {
            logger.info('eth-OfferCreated');

            const {
                import_id,
                DC_node_id,
                total_escrow_time_in_minutes,
                max_token_amount_per_DH,
                min_stake_amount_per_DH,
                min_reputation,
                data_hash,
                data_size_in_bytes,
            } = eventData;

            await dhService.handleOffer(
                import_id,
                DC_node_id,
                total_escrow_time_in_minutes * 60000, // In ms.
                max_token_amount_per_DH,
                min_stake_amount_per_DH,
                min_reputation,
                data_size_in_bytes,
                data_hash,
                false,
            );
        });

        this.globalEmitter.on('eth-AddedPredeterminedBid', async (eventData) => {
            logger.info('eth-AddedPredeterminedBid');

            const {
                import_id,
                DH_wallet,
                DH_node_id,
                total_escrow_time_in_minutes,
                max_token_amount_per_DH,
                min_stake_amount_per_DH,
                data_size_in_bytes,
            } = eventData;

            if (DH_wallet !== config.node_wallet
                || config.identity !== DH_node_id.substring(2, 42)) {
                // Offer not for me.
                return;
            }

            // TODO: This is a hack. DH doesn't know with whom to sign the offer.
            // Try to dig it from events.
            const createOfferEventEventModel = await Models.events.findOne({
                where: {
                    event: 'OfferCreated',
                    import_id,
                },
            });

            if (!createOfferEventEventModel) {
                logger.warn(`Couldn't find event CreateOffer for offer ${import_id}.`);
                return;
            }

            try {
                const createOfferEvent = createOfferEventEventModel.get({ plain: true });
                const createOfferEventData = JSON.parse(createOfferEvent.data);

                await dhService.handleOffer(
                    import_id,
                    createOfferEventData.DC_node_id.substring(2, 42),
                    total_escrow_time_in_minutes * 60000, // In ms.
                    max_token_amount_per_DH,
                    min_stake_amount_per_DH,
                    createOfferEventData.min_reputation,
                    data_size_in_bytes,
                    createOfferEventData.data_hash,
                    true,
                );
            } catch (error) {
                logger.error(`Failed to handle predetermined bid. ${error}.`);
            }
        });

        this.globalEmitter.on('eth-offer-canceled', (event) => {
            logger.info('eth-offer-canceled');
        });

        this.globalEmitter.on('eth-bid-taken', (event) => {
            logger.info('eth-bid-taken');

            const {
                DC_wallet,
                DC_node_id,
                import_id,
                total_escrow_time,
                min_stake_amount,
                data_size,
            } = event.returnValues;
        });

        this.globalEmitter.on('kad-data-location-response', async (request, response) => {
            logger.info('kad-data-location-response');

            /*
                dataLocationResponseObject = {
                    message: {
                        wallet: DH_WALLET,
                        nodeId: KAD_ID,
                        imports: [
                                     importId: …
                                ],
                        dataSize: DATA_BYTE_SIZE,
                        stakeFactor: X
                    }
                    messageSignature: {
                        c: …,
                        r: …,
                        s: …
                    }
                }
             */
            try {
                const dataLocationResponseObject = request.params.message;
                const { message, messageSignature } = dataLocationResponseObject;

                if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                    const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                    logger.warn(returnMessage);
                    response.send({
                        status: 'FAIL',
                        message: returnMessage,
                    });
                    return;
                }

                await dvService.handleDataLocationResponse(message);
            } catch (error) {
                logger.error(`Failed to process location response. ${error}.`);
                response.send({
                    status: 'FAIL',
                    message: error,
                });
                return;
            }

            response.send({
                status: 'OK',
                message: 'Location response successfully noted.',
            });
        });

        this.globalEmitter.on('kad-data-read-request', async (request, response) => {
            logger.info('kad-data-read-request');

            const dataReadRequestObject = request.params.message;
            const { message, messageSignature } = dataReadRequestObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                logger.warn(returnMessage);
                response.send({
                    status: 'FAIL',
                    message: returnMessage,
                });
                return;
            }

            try {
                await dhService.handleDataReadRequest(message);
            } catch (error) {
                const errorMessage = `Failed to process data read request. ${error}.`;
                logger.warn(errorMessage);
                response.send({
                    status: 'FAIL',
                    message: errorMessage,
                });
                return;
            }
            response.send({
                status: 'OK',
                message: 'Successfully noted. Data is being prepared and on the way.',
            });
        });

        this.globalEmitter.on('kad-data-read-response', async (request, response) => {
            logger.info('kad-data-read-response');

            const dataReadResponseObject = request.params.message;
            const { message, messageSignature } = dataReadResponseObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                logger.warn(returnMessage);
                response.send({
                    status: 'FAIL',
                    message: returnMessage,
                });
                return;
            }

            try {
                await dvService.handleDataReadResponse(message);
            } catch (error) {
                const errorMessage = `Failed to process data read response. ${error}.`;
                logger.warn(errorMessage);
                response.send({
                    status: 'FAIL',
                    message: errorMessage,
                });
                return;
            }
            response.send({
                status: 'OK',
                message: 'Successfully imported data.',
            });
        });

        this.globalEmitter.on('kad-send-encrypted-key', async (request, response) => {
            logger.info('kad-send-encrypted-key');

            const encryptedPaddedKeyObject = request.params.message;
            const { message, messageSignature } = encryptedPaddedKeyObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                logger.warn(returnMessage);
                response.send({
                    status: 'FAIL',
                    message: returnMessage,
                });
                return;
            }

            try {
                await dvService.handleEncryptedPaddedKey(message);
            } catch (error) {
                const errorMessage = `Failed to process encrypted key response. ${error}.`;
                logger.warn(errorMessage);
                response.send({
                    status: 'FAIL',
                    message: errorMessage,
                });
                return;
            }
            response.send({
                status: 'OK',
                message: 'Verified data.',
            });
        });

        this.globalEmitter.on('kad-verify-import-request', async (request, response) => {
            logger.info('kad-verify-import-request');

            const { wallet: kadWallet } = request.contact[1];
            const { epk, importId, encryptionKey } = request.params.message;

            // TODO: Add guard for fake replations.
            const success = await dcService.verifyImport(
                epk,
                importId, encryptionKey, kadWallet, request.contact[0],
            );
            if (success) {
                response.send({
                    status: 'OK',
                    message: 'Data successfully verified',
                });
            } else {
                response.send({
                    status: 'Failed',
                    message: 'Verification failed',
                });
            }
        });

        this.globalEmitter.on('eth-LitigationInitiated', async (eventData) => {
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
            }
        });

        this.globalEmitter.on('eth-LitigationCompleted', async (eventData) => {
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

    emit(event, ...args) {
        this.globalEmitter.emit(event, ...args);
    }
}

module.exports = EventEmitter;

