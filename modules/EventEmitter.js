const Graph = require('./Graph');
const Challenge = require('./Challenge');
const Utilities = require('./Utilities');
const config = require('./Config');
const Models = require('../models');
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

        this.apiEmitter = new events.EventEmitter();
        this.kadEmitter = new events.EventEmitter();
        this.blockchainEmitter = new events.EventEmitter();
    }

    /**
     * Initializes event listeners
     */
    initialize() {
        this._initializeAPIEmitter();
        this._initializeKadEmitter();
        this._initializeBlockchainEmitter();
    }

    /**
     * Initializes API related emitter
     * @private
     */
    _initializeAPIEmitter() {
        const {
            dcService,
            dhService,
            dvService,
            importer,
            blockchain,
            product,
            logger,
        } = this.ctx;

        this.apiEmitter.on('import-request', (data) => {
            importer.importXML(data.filepath, (response) => {
                // emit response
            });
        });

        this.apiEmitter.on('trail', (data) => {
            product.getTrailByQuery(data.query).then((res) => {
                if (res.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }
                data.response.send(res);
            }).catch((error) => {
                logger.error(`Failed to get trail for query ${data.query}`);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            });
        });

        this.apiEmitter.on('get-imports', (data) => {
            product.getImports(data.query).then((res) => {
                if (res.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }
                data.response.send(res);
            }).catch((error) => {
                logger.error(`Failed to get imports for query ${data.query}`);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            });
        });

        this.apiEmitter.on('query', (data) => {
            product.getVertices(data.query).then((res) => {
                if (res.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }
                data.response.send(res);
            }).catch((error) => {
                logger.error(`Failed to get vertices for query ${data.query}`);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            });
        });

        this.apiEmitter.on('get_root_hash', (data) => {
            const dcWallet = data.query.dc_wallet;
            if (dcWallet == null) {
                data.response.status(400);
                data.response.send({
                    message: 'dc_wallet parameter query is missing',
                });
                return;
            }
            const importId = data.query.import_id;
            if (importId == null) {
                data.response.status(400);
                data.response.send({
                    message: 'import_id parameter query is missing',
                });
                return;
            }
            blockchain.getRootHash(dcWallet, importId).then((res) => {
                data.response.send(res);
            }).catch((err) => {
                logger.error(`Failed to get root hash for query ${data.query}`);
                data.response.status(500);
                data.response.send(500); // TODO rethink about status codes
            });
        });

        this.apiEmitter.on('network-query', (data) => {
            dvService.queryNetwork(data.query)
                .then((queryId) => {
                    data.response.status(201);
                    data.response.send({
                        message: 'Query sent successfully.',
                        data: queryId,
                    });
                    dvService.handleQuery(queryId).then((offer) => {
                        if (!offer) {
                            logger.info(`No offers for query ${queryId} handled.`);
                        } else {
                            logger.info(`Offers for query ${queryId} are collected`);
                            // TODO: Fire socket event for Houston
                        }
                    }).catch(error => logger.error(`Failed handle query. ${error}.`));
                }).catch(error => logger.error(`Failed query network. ${error}.`));
        });

        this.apiEmitter.on('choose-offer', async (data) => {
            const failFunction = (error) => {
                logger.warn(error);
                data.response.status(400);
                data.response.send({
                    message: 'Failed to handle query',
                    data: [],
                });
            };
            const { query_id, reply_id } = data;

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
                dvService.handleReadOffer(offer);
                logger.info(`Read offer ${offer.id} for query ${offer.query_id} initiated.`);
                data.response.status(200);
                data.response.send({
                    message: `Read offer ${offer.id} for query ${offer.query_id} initiated.`,
                });
            } catch (e) {
                failFunction(`Failed to handle offer ${offer.id} for query ${offer.query_id} handled. ${e}.`);
            }
        });

        this.apiEmitter.on('network-query-status', async (data) => {
            const { id, response } = data;

            const networkQuery = await Models.network_queries.find({ where: { id } });
            if (networkQuery.status === 'FINISHED') {
                try {
                    const vertices = await dhService.dataLocationQuery(id);

                    response.status(200);
                    response.send({
                        message: `Query status ${networkQuery.status}.`,
                        query_id: networkQuery.id,
                        vertices,
                    });
                } catch (error) {
                    logger.info(`Failed to process network query status for ID ${id}. ${error}.`);
                    response.status(500);
                    response.send({
                        error: 'Fail to process.',
                        query_id: networkQuery.id,
                    });
                }
            } else {
                response.status(200);
                response.send({
                    message: `Query status ${networkQuery.status}.`,
                    query_id: networkQuery.id,
                });
            }
        });

        const processImport = async (response, error, data) => {
            if (response === null) {
                data.response.status(error.status);
                data.response.send({
                    message: error.message,
                });
                return;
            }

            const {
                import_id,
                root_hash,
                total_documents,
                wallet,
            } = response;

            try {
                await Models.data_info
                    .create({
                        import_id,
                        root_hash,
                        data_provider_wallet: wallet,
                        import_timestamp: new Date(),
                        total_documents,
                    }).catch((error) => {
                        logger.error(error);
                        data.response.status(500);
                        data.response.send({
                            message: error,
                        });
                    });

                data.response.status(201);
                data.response.send({
                    import_id,
                });
            } catch (error) {
                logger.error(`Failed to register import. Error ${error}.`);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            }
        };

        this.apiEmitter.on('offer-status', async (data) => {
            const { external_id } = data;
            const offer = await dcService.getOffer(external_id);
            if (offer) {
                data.response.status(200);
                data.response.send({
                    offer_status: offer.status,
                });
            } else {
                logger.error(`There is no offer for external ID ${external_id}`);
                data.response.status(404);
                data.response.send({
                    message: 'Offer not found',
                });
            }
        });

        this.apiEmitter.on('create-offer', async (data) => {
            const { import_id } = data;

            try {
                let vertices = await this.graphStorage.findVerticesByImportId(import_id);
                vertices = vertices.map((vertex) => {
                    delete vertex.private;
                    return vertex;
                });

                const dataimport = await Models.data_info.findOne({ where: { import_id } });
                if (dataimport == null) {
                    throw new Error('This import does not exist in the database');
                }

                const replicationId = await dcService.createOffer(
                    import_id,
                    dataimport.root_hash,
                    dataimport.total_documents,
                    vertices,
                );
                data.response.status(201);
                data.response.send({
                    replication_id: replicationId,
                });
            } catch (error) {
                logger.error(`Failed to create offer. ${error}.`);
                data.response.status(405);
                data.response.send({
                    message: `Failed to start offer. ${error}.`,
                });
            }
        });


        this.apiEmitter.on('gs1-import-request', async (data) => {
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

        this.apiEmitter.on('wot-import-request', async (data) => {
            try {
                const responseObject = await importer.importWOT(data.filepath);
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
    }

    /**
     * Initializes blockchain related emitter
     * @private
     */
    _initializeBlockchainEmitter() {
        const {
            dhService,
            logger,
        } = this.ctx;

        this.blockchainEmitter.on('eth-OfferCreated', async (eventData) => {
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

        this.blockchainEmitter.on('eth-AddedPredeterminedBid', async (eventData) => {
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

        this.blockchainEmitter.on('eth-offer-canceled', (event) => {
            logger.info('eth-offer-canceled');
        });

        this.blockchainEmitter.on('eth-bid-taken', (event) => {
            logger.info('eth-bid-taken');
        });

        this.blockchainEmitter.on('eth-LitigationInitiated', async (eventData) => {
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

        this.blockchainEmitter.on('eth-LitigationCompleted', async (eventData) => {
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
     * Initializes Kadence related emitter
     * @private
     */
    _initializeKadEmitter() {
        const {
            dcService,
            dhService,
            dvService,
            logger,
            challenger,
            dataReplication,
            network,
        } = this.ctx;

        this.kadEmitter.on('kad-data-location-request', async (kadMessage) => {
            logger.info('kad-data-location-request received');

            const { message, messageSignature } = kadMessage;

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

        // async
        this.kadEmitter.on('kad-payload-request', async (request) => {
            logger.trace(`kad-payload-request arrived from ${request.contact[0]}`);
            await dhService.handleImport(request.params.message.payload);

            // TODO: send fail in case of fail.
        });

        // sync
        this.kadEmitter.on('kad-replication-request', async (request) => {
            logger.trace('kad-replication-request received');

            const { import_id, wallet } = request.params.message;
            const { wallet: kadWallet } = request.contact[1];
            const kadIdentity = request.contact[0];

            if (!import_id || !wallet) {
                logger.warn('Asked replication without providing import ID or wallet.');
                return;
            }

            if (kadWallet !== wallet) {
                logger.warn(`Wallet from KADemlia differs from replication request for import ID ${import_id}.`);
            }

            const offerModel = await Models.offers.findOne({
                where: {
                    import_id,
                    status: { [Models.Sequelize.Op.in]: ['FINALIZING', 'FINALIZED'] },
                },
                order: [
                    ['id', 'DESC'],
                ],
            });
            if (!offerModel) {
                logger.warn(`Replication request for offer I don't know: ${import_id}.`);
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
            const verticesPromise = this.graphStorage.findVerticesByImportId(offer.import_id);
            const edgesPromise = this.graphStorage.findEdgesByImportId(offer.import_id);

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

            const dataInfo = Models.data_info.find({ where: { import_id } });

            logger.info('[DC] Preparing to enter sendPayload');
            const data = {
                contact: kadIdentity,
                vertices,
                edges,
                import_id,
                public_key: keyPair.publicKey,
                root_hash: offer.data_hash,
                data_provider_wallet: dataInfo.data_provider_wallet,
                total_escrow_time: offer.total_escrow_time,
            };

            dataReplication.sendPayload(data).then(() => {
                logger.info(`[DC] Payload sent. Replication ID ${replicatedData.id}.`);
            }).catch((error) => {
                logger.warn(`Failed to send payload to ${kadIdentity}. Replication ID ${replicatedData.id}. ${error}`);
            });
        });

        // async
        this.kadEmitter.on('kad-replication-finished', () => {
            logger.warn('Notified of finished replication, preparing to start challenges');
            challenger.startChallenging();
        });

        // sync
        // TODO this call should be refactored to be async
        this.kadEmitter.on('kad-challenge-request', (request, response) => {
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

        this.kadEmitter.on('kad-bidding-won', (message) => {
            logger.info('Wow I won bidding. Let\'s get into it.');
        });

        // async
        this.kadEmitter.on('kad-data-location-response', async (request) => {
            logger.info('kad-data-location-response');
            try {
                const dataLocationResponseObject = request.params.message;
                const { message, messageSignature } = dataLocationResponseObject;

                if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                    const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                    logger.warn(returnMessage);
                    return;
                }

                await dvService.handleDataLocationResponse(message);
            } catch (error) {
                logger.error(`Failed to process location response. ${error}.`);
            }
        });

        // async
        this.kadEmitter.on('kad-data-read-request', async (request) => {
            logger.info('kad-data-read-request');

            const dataReadRequestObject = request.params.message;
            const { message, messageSignature } = dataReadRequestObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                logger.warn(returnMessage);
                return;
            }
            await dhService.handleDataReadRequest(message);
        });

        // async
        this.kadEmitter.on('kad-data-read-response', async (request) => {
            logger.info('kad-data-read-response');

            if (request.params.status === 'FAIL') {
                logger.warn(`Failed to send data-read-request. ${request.params.message}`);
                return;
            }
            const dataReadResponseObject = request.params.message;
            const { message, messageSignature } = dataReadResponseObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message}`);
                return;
            }

            try {
                await dvService.handleDataReadResponse(message);
            } catch (error) {
                logger.warn(`Failed to process data read response. ${error}.`);
            }
        });

        // async
        this.kadEmitter.on('kad-send-encrypted-key', async (request) => {
            logger.info('kad-send-encrypted-key');

            const encryptedPaddedKeyObject = request.params.message;
            const { message, messageSignature } = encryptedPaddedKeyObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message}`);
                return;
            }

            try {
                await dvService.handleEncryptedPaddedKey(message);
                network.kademlia().sendEncryptedKeyProcessResult({
                    status: 'SUCCESS',
                }, request.contact[0]);
            } catch (error) {
                const errorMessage = `Failed to process encrypted key response. ${error}.`;
                logger.warn(errorMessage);
                network.kademlia().sendEncryptedKeyProcessResult({
                    status: 'FAIL',
                    message: error.message,
                }, request.contact[0]);
            }
        });

        // async
        this.kadEmitter.on('kad-encrypted-key-process-result', async (request) => {
            const { status } = request.params.message;
            if (status === 'SUCCESS') {
                logger.info('DV successfully processed the encrypted key');
            } else {
                logger.info('DV failed to process the encrypted key');
            }
        });

        // async
        this.kadEmitter.on('kad-verify-import-request', async (request) => {
            logger.info('kad-verify-import-request');

            const { wallet: kadWallet } = request.contact[1];
            const { epk, importId, encryptionKey } = request.params.message;

            // TODO: Add guard for fake replations.
            dcService.verifyImport(
                epk,
                importId, encryptionKey, kadWallet, request.contact[0],
            );
        });

        // async
        this.kadEmitter.on('kad-verify-import-response', async (request) => {
            logger.info('kad-verify-import-response');

            const { status, import_id } = request.params.message;
            if (status === 'success') {
                logger.notify(`Key verification for import ${import_id} succeeded`);
            } else {
                logger.notify(`Key verification for import ${import_id} failed`);
            }
        });
    }

    /**
     * Emits event via appropriate event emitter
     */
    emit(event, ...args) {
        if (event.startsWith('eth-')) {
            this.blockchainEmitter.emit(event, ...args);
        } else if (event.startsWith('kad-')) {
            this.kadEmitter.emit(event, ...args);
        } else {
            this.apiEmitter.emit(event, ...args);
        }
    }
}

module.exports = EventEmitter;

