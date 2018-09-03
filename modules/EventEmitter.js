const Graph = require('./Graph');
const Challenge = require('./Challenge');
const Utilities = require('./Utilities');
const Models = require('../models');
const Encryption = require('./Encryption');
const ImportUtilities = require('./ImportUtilities');
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

        this._MAPPINGS = {};
        this._MAX_LISTENERS = 15; // limits the number of listeners in order to detect memory leaks
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
            dvService,
            importer,
            blockchain,
            product,
            logger,
            remoteControl,
            config,
            profileService,
            dcController,
            dvController,
            notifyError,
        } = this.ctx;

        this._on('api-import-request', (data) => {
            importer.importXML(data.filepath, (response) => {
                // emit response
            });
        });

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
            logger.info(`Get trail triggered with query ${data.query}`);
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

        this._on('api-get-imports', (data) => {
            logger.info(`Get imports triggered with query ${JSON.stringify(data.query)}`);
            product.getImports(data.query).then((res) => {
                if (res.length === 0) {
                    data.response.status(204);
                } else {
                    data.response.status(200);
                }
                data.response.send(res);
            }).catch((error) => {
                logger.error(`Failed to get imports for query ${JSON.stringify(data.query)}`);
                notifyError(error);
                data.response.status(500);
                data.response.send({
                    message: error,
                });
            });
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
            logger.info(`Get root hash triggered with dcWallet ${dcWallet} and importId ${importId}`);
            blockchain.getRootHash(dcWallet, importId).then((res) => {
                if (res) {
                    if (!Utilities.isZeroHash(res.graph_hash)) {
                        data.response.status(200);
                        data.response.send({
                            root_hash: res.graph_hash,
                            import_hash: res.import_hash,
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
            if (!config.enoughFunds) {
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
            if (!config.enoughFunds) {
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
            const { query_id, reply_id, import_id } = data;
            logger.info(`Choose offer triggered with query ID ${query_id}, reply ID ${reply_id} and import ID ${import_id}`);

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
                dvController.handleDataReadRequest(query_id, import_id, reply_id);
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
                        message: `Query status ${networkQuery.status}.`,
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
                remoteControl.importFailed(error);
                notifyError(error);
                return;
            }

            const {
                import_id,
                root_hash,
                import_hash,
                total_documents,
                wallet, // TODO: Sender's wallet is ignored for now.
                vertices,
            } = response;

            try {
                const dataSize = bytes(JSON.stringify(vertices));
                await Models.data_info
                    .create({
                        import_id,
                        root_hash,
                        import_hash,
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
                    this.emit('api-create-offer', { import_id, response: data.response });
                } else {
                    await dcController.writeRootHash(import_id, root_hash, import_hash);

                    data.response.status(201);
                    data.response.send({
                        message: 'Import success',
                        import_id,
                        import_hash,
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
            if (!config.enoughFunds) {
                data.response.status(400);
                data.response.send({
                    message: 'Insufficient funds',
                });
                return;
            }
            const {
                import_id,
                total_escrow_time,
                max_token_amount,
                min_stake_amount,
                min_reputation,
            } = data;

            try {
                logger.info(`Preparing to create offer for import ${import_id}`);

                const dataimport = await Models.data_info.findOne({ where: { import_id } });
                if (dataimport == null) {
                    throw new Error('This import does not exist in the database');
                }

                const replicationId = await dcController.createOffer(
                    import_id, dataimport.root_hash, dataimport.total_documents, total_escrow_time,
                    max_token_amount, min_stake_amount, min_reputation,
                );

                data.response.status(201);
                data.response.send({
                    replication_id: replicationId,
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

                await profileService.depositToken(atrac_amount);
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

                await profileService.withdrawToken(atrac_amount);

                data.response.status(200);
                data.response.send({
                    message: `Successfully withdrawn ${atrac_amount} ATRAC to wallet ${config.node_wallet}`,
                });
                remoteControl.tokensWithdrawSucceeded(`Successfully withdrawn ${atrac_amount} ATRAC`);
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
            dhController,
            notifyError,
        } = this.ctx;

        this._on('eth-OfferCreated', async (eventData) => {
            if (!config.enoughFunds) {
                return;
            }
            const {
                import_id,
                DC_node_id,
                total_escrow_time_in_minutes,
                max_token_amount_per_byte_minute,
                min_stake_amount_per_byte_minute,
                min_reputation,
                data_hash,
                data_size_in_bytes,
            } = eventData;

            await dhController.handleOffer(
                import_id, DC_node_id, total_escrow_time_in_minutes,
                max_token_amount_per_byte_minute, min_stake_amount_per_byte_minute,
                min_reputation, data_size_in_bytes, data_hash, false,
            );
        });

        this._on('eth-AddedPredeterminedBid', async (eventData) => {
            if (!config.enoughFunds) {
                return;
            }
            const {
                import_id,
                DH_wallet,
                DH_node_id,
                total_escrow_time_in_minutes,
                max_token_amount_per_byte_minute,
                min_stake_amount_per_byte_minute,
                data_size_in_bytes,
            } = eventData;

            if (DH_wallet !== config.node_wallet
                || config.identity !== DH_node_id.substring(2, 42)) {
                // Offer not for me.
                return;
            }

            logger.info(`Added as predetermined for import ${import_id}`);

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

                const dcNodeId = createOfferEventData.DC_node_id.substring(2, 42);
                await dhController.handleOffer(
                    import_id, dcNodeId, total_escrow_time_in_minutes,
                    max_token_amount_per_byte_minute, min_stake_amount_per_byte_minute,
                    createOfferEventData.min_reputation, data_size_in_bytes,
                    createOfferEventData.data_hash, true,
                );
            } catch (error) {
                logger.error(`Failed to handle predetermined bid. ${error}.`);
                notifyError(error);
            }
        });

        this._on('eth-offer-canceled', (event) => {
            logger.info(`Ongoing offer ${event.import_id} canceled`);
        });

        this._on('eth-bid-taken', (event) => {
            if (event.DH_wallet !== config.node_wallet) {
                logger.notify(`Bid not accepted for offer ${event.import_id}`);
                // Offer not for me.
                return;
            }
            logger.notify(`Bid accepted for offer ${event.import_id}`);
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

        this._on('eth-EscrowVerified', async (eventData) => {
            const {
                import_id,
                DH_wallet,
            } = eventData;

            if (config.node_wallet === DH_wallet) {
                // Event is for me.
                logger.trace(`Escrow for import ${import_id} verified`);
                try {
                    // TODO: Possible race condition if another bid for same import came meanwhile.
                    const bid = await Models.bids.findOne({
                        where: {
                            import_id,
                        },
                        order: [
                            ['id', 'DESC'],
                        ],
                    });

                    if (!bid) {
                        logger.warn(`Could not find bid for import ID ${import_id}. I won't be able to withdraw tokens.`);
                        return;
                    }
                } catch (error) {
                    logger.error(`Failed to get bid for import ID ${import_id}. ${error}.`);
                    notifyError(error);
                }
            }
        });
    }

    /**
     * Initializes Kadence related emitter
     * @private
     */
    _initializeKadEmitter() {
        const {
            dhService,
            dvService,
            logger,
            dataReplication,
            network,
            blockchain,
            remoteControl,
            dhController,
            dcController,
            dvController,
            notifyError,
        } = this.ctx;

        this._on('kad-data-location-request', async (kadMessage) => {
            const { message, messageSignature } = kadMessage;
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
                await dhController.handleDataLocationRequest(msgId, msgNodeId, msgWallet, msgQuery);
            } catch (error) {
                const errorMessage = `Failed to process data location request. ${error}.`;
                logger.warn(errorMessage);
                notifyError(error);
            }
        });

        // async
        this._on('kad-payload-request', async (request) => {
            logger.info(`Data for replication arrived from ${request.contact[0]}`);

            const importId = request.params.message.payload.import_id;
            const { vertices } = request.params.message.payload;
            const { edges } = request.params.message.payload;
            const wallet = request.params.message.payload.dc_wallet;
            const publicKey = request.params.message.payload.public_key;

            await dhController.handleReplicationImport(
                importId, vertices,
                edges, wallet, publicKey,
            );

            // TODO: send fail in case of fail.
        });

        // sync
        this._on('kad-replication-request', async (request) => {
            const { import_id, wallet } = request.params.message;
            const { wallet: kadWallet } = request.contact[1];
            const kadIdentity = request.contact[0];

            logger.info(`Request for replication of ${import_id} received. Sender ${kadIdentity}`);

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
            const offerDhIds = offer.dh_ids;
            const offerWallets = offer.dh_wallets;

            // TODO: Bids should -be stored for all predetermined and others and then checked here.
            if (!offerDhIds.includes(kadIdentity) || !offerWallets.includes(kadWallet)) {
                // Check escrow to see if it was a chosen bid. Expected status to be initiated.
                const escrow = await blockchain.getEscrow(import_id, wallet);

                if (escrow.escrow_status === 0) {
                    // const errorMessage = `Replication request
                    //  for offer you didn't apply: ${import_id}.`;
                    logger.info(`DH ${kadIdentity} requested data without offer for import ID ${import_id}.`);
                    return;
                }
            }

            const objectClassesPromise = this.graphStorage.findObjectClassVertices();
            const verticesPromise = this.graphStorage.findVerticesByImportId(offer.import_id);
            const edgesPromise = this.graphStorage.findEdgesByImportId(offer.import_id);

            const values = await Promise.all([verticesPromise, edgesPromise, objectClassesPromise]);
            let vertices = values[0];
            const edges = values[1];
            const objectClassVertices = values[2];

            vertices = vertices.concat(...objectClassVertices);
            ImportUtilities.deleteInternal(vertices);

            const keyPair = Encryption.generateKeyPair();
            Graph.encryptVertices(vertices, keyPair.privateKey);

            const replicatedData = await Models.replicated_data.create({
                dh_id: kadIdentity,
                import_id,
                offer_id: offer.id,
                data_private_key: keyPair.privateKey,
                data_public_key: keyPair.publicKey,
                status: 'PENDING',
            });

            const dataInfo = Models.data_info.find({ where: { import_id } });

            logger.info(`Preparing to send payload for ${import_id} to ${kadIdentity}`);
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
                logger.info(`Payload for ${import_id} sent to ${kadIdentity}.`);
            }).catch((error) => {
                logger.warn(`Failed to send payload to ${kadIdentity}. Replication ID ${replicatedData.id}. ${error}`);
                notifyError(error);
            });
        });

        // async
        this._on('kad-replication-finished', async () => {
            logger.notify('Replication finished, preparing to start challenges');
        });

        // sync
        // TODO this call should be refactored to be async
        this._on('kad-challenge-request', (request, response) => {
            logger.info(`Challenge arrived: Block ID ${request.params.message.payload.block_id}, Import ID ${request.params.message.payload.import_id}`);
            const challenge = request.params.message.payload;

            this.graphStorage.findVerticesByImportId(challenge.import_id).then((vertices) => {
                ImportUtilities.unpackKeys(vertices, []);
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
                notifyError(error);

                response.send({
                    status: 'fail',
                }, (error) => {
                    logger.error(`Failed to send 'fail' status.v Error: ${error}.`);
                });
            });
        });

        this._on('kad-bidding-won', (message) => {
            logger.notify('Wow I won bidding. Let\'s get into it.');
        });

        // async
        this._on('kad-data-location-response', async (request) => {
            logger.info('DH confirms possesion of required data');
            try {
                const dataLocationResponseObject = request.params.message;
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
        this._on('kad-data-read-request', async (request) => {
            logger.info('Request for data read received');

            const dataReadRequestObject = request.params.message;
            const { message, messageSignature } = dataReadRequestObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                const returnMessage = `We have a forger here. Signature doesn't match for message: ${message}`;
                logger.warn(returnMessage);
                return;
            }
            await dhController.handleDataReadRequestFree(message);
        });

        // async
        this._on('kad-data-read-response', async (request) => {
            logger.info('Encrypted data received');

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
                await dvController.handleDataReadResponseFree(message);
            } catch (error) {
                logger.warn(`Failed to process data read response. ${error}.`);
                notifyError(error);
            }
        });

        // async
        this._on('kad-send-encrypted-key', async (request) => {
            logger.info('Initial info received to unlock data');

            const encryptedPaddedKeyObject = request.params.message;
            const { message, messageSignature } = encryptedPaddedKeyObject;

            if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
                logger.warn(`We have a forger here. Signature doesn't match for message: ${message}`);
                return;
            }

            try {
                await dvService.handleEncryptedPaddedKey(message);
                await network.kademlia().sendEncryptedKeyProcessResult({
                    status: 'SUCCESS',
                }, request.contact[0]);
            } catch (error) {
                const errorMessage = `Failed to process encrypted key response. ${error}.`;
                logger.warn(errorMessage);
                notifyError(error);
                await network.kademlia().sendEncryptedKeyProcessResult({
                    status: 'FAIL',
                    message: error.message,
                }, request.contact[0]);
            }
        });

        // async
        this._on('kad-encrypted-key-process-result', async (request) => {
            const { status } = request.params.message;
            if (status === 'SUCCESS') {
                logger.notify(`DV ${request.contact[0]} successfully processed the encrypted key`);
            } else {
                logger.notify(`DV ${request.contact[0]} failed to process the encrypted key`);
            }
        });

        // async
        this._on('kad-verify-import-request', async (request) => {
            const { wallet: dhWallet } = request.contact[1];
            const { epk, importId, encryptionKey } = request.params.message;

            logger.info(`Request to verify encryption key of replicated data received from ${dhWallet}`);

            const dcNodeId = request.contact[0];
            await dcController.verifyKeys(importId, dcNodeId, dhWallet, epk, encryptionKey);
        });

        // async
        this._on('kad-verify-import-response', async (request) => {
            const { status, import_id } = request.params.message;
            if (status === 'success') {
                logger.notify(`Key verification for import ${import_id} succeeded`);
                remoteControl.replicationVerificationStatus(`DC successfully verified replication for import ${import_id}`);
            } else {
                logger.notify(`Key verification for import ${import_id} failed`);
                remoteControl.replicationVerificationStatus(`Key verification for import ${import_id} failed`);
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

