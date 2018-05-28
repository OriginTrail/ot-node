const Storage = require('./Database/SystemStorage');
const Graph = require('./Graph');
const Challenge = require('./Challenge');
const challenger = require('./Challenger');
const Utilities = require('./Utilities');
const BN = require('bn.js');
const config = require('./Config');
const Models = require('../models');

const log = Utilities.getLogger();

const events = require('events');

class EventEmitter {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.product = ctx.product;
        this.graphStorage = ctx.graphStorage;
        this.globalEmitter = new events.EventEmitter();
    }

    /**
     * Initializes event listeners
     */
    initialize() {
        const {
            dcService, dhService, dataReplication, importer,
        } = this.ctx;

        this.globalEmitter.on('import-request', (data) => {
            importer.importXML(data.filepath, (response) => {
                // emit response
            });
        });

        this.globalEmitter.on('trail', (data) => {
            this.product.p.getTrailByQuery(data.query).then((res) => {
                data.response.send(res);
            }).catch(() => {
                log.error(`Failed to get trail for query ${data.query}`);
                data.response.send(500); // TODO rethink about status codes
            });
        });

        const processImport = async (response, data) => {
            if (response === null) {
                data.response.send({
                    status: 500,
                    message: 'Failed to parse XML.',
                });
                return;
            }

            const {
                data_id,
                root_hash,
                total_documents,
                vertices,
            } = response;

            try {
                await Storage.connect();
                await Storage.runSystemQuery('INSERT INTO data_info (data_id, root_hash, import_timestamp, total_documents) values(?, ? , ? , ?)', [data_id, root_hash, total_documents]);
                await dcService.createOffer(data_id, root_hash, total_documents, vertices);
            } catch (error) {
                log.error(`Failed to start offer. Error ${error}.`);
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
            const response = await importer.importXMLgs1(data.filepath);
            await processImport(response, data);
        });

        this.globalEmitter.on('wot-import-request', async (data) => {
            const response = await importer.importWOT(data.filepath);
            await processImport(response, data);
        });

        this.globalEmitter.on('replication-request', async (request, response) => {
            log.trace('replication-request received');

            const { offer_hash, wallet } = request.params.message;
            const { wallet: kadWallet } = request.contact[1];

            if (!offer_hash || !wallet) {
                const errorMessage = 'Asked replication without providing offer hash or wallet.';
                log.warn(errorMessage);
                response.send({ status: 'fail', error: errorMessage });
                return;
            }

            if (kadWallet !== wallet) {
                log.warn(`Wallet from KADemlia differs from replication request for offer hash ${offer_hash}.`);
            }

            const offerModel = await Models.offers.findOne({ where: { id: offer_hash } });
            if (!offerModel) {
                const errorMessage = `Replication request for offer I don't know: ${offer_hash}.`;
                log.warn(errorMessage);
                response.send({ status: 'fail', error: errorMessage });
                return;
            }

            const offer = offerModel.get({ plain: true });

            const verticesPromise = this.graphStorage.findVerticesByImportId(offer.import_id);
            const edgesPromise = this.graphStorage.findEdgesByImportId(offer.import_id);

            Promise.all([verticesPromise, edgesPromise]).then((values) => {
                const vertices = values[0];
                const edges = values[1];

                Graph.encryptVertices(
                    wallet,
                    request.contact[0],
                    vertices.filter(vertex => vertex.vertex_type !== 'CLASS'),
                    Storage,
                ).then((encryptedVertices) => {
                    log.info('[DC] Preparing to enter sendPayload');
                    const data = {};
                    data.offer_hash = offer.id;
                    // eslint-disable-next-line
                    data.contact = request.contact[0];
                    data.vertices = vertices;
                    data.edges = edges;
                    data.import_id = offer.import_id;
                    data.encryptedVertices = encryptedVertices;
                    data.total_escrow_time = offer.total_escrow_time;
                    dataReplication.sendPayload(data).then(() => {
                        log.info('[DC] Payload sent');
                    });
                }).catch((e) => {
                    console.log(e);
                });
            });

            response.send({ status: 'success' });
        });

        this.globalEmitter.on('payload-request', async (request) => {
            log.trace(`payload-request arrived from ${request.contact[0]}`);
            await dhService.handleImport(request.params.message.payload);

            // TODO doktor: send fail in case of fail.
        });

        this.globalEmitter.on('replication-finished', (status) => {
            log.warn('Notified of finished replication, preparing to start challenges');
            challenger.startChallenging();
        });

        this.globalEmitter.on('kad-challenge-request', (request, response) => {
            log.trace(`Challenge arrived: Block ID ${request.params.message.payload.block_id}, Import ID ${request.params.message.payload.import_id}`);
            const challenge = request.params.message.payload;

            this.graphStorage.findVerticesByImportId(challenge.import_id).then((vertices) => {
                vertices = vertices.filter(vertex => vertex.vertex_type !== 'CLASS'); // Dump class objects.
                const answer = Challenge.answerTestQuestion(challenge.block_id, vertices, 16);
                log.trace(`Sending answer to question for import ID ${challenge.import_id}, block ID ${challenge.block_id}`);
                response.send({
                    status: 'success',
                    answer,
                }, (error) => {
                    log.error(`Failed to send challenge answer to ${challenge.import_id}. Error: ${error}.`);
                });
            }).catch((error) => {
                log.error(`Failed to get data. ${error}.`);

                response.send({
                    status: 'fail',
                }, (error) => {
                    log.error(`Failed to send 'fail' status.v Error: ${error}.`);
                });
            });
        });

        /**
         * Handles bidding-broadcast on the DH side
         */
        this.globalEmitter.on('bidding-broadcast', async (message) => {
            log.info('bidding-broadcast received');

            const {
                dataId,
                dcId,
                dcWallet,
                totalEscrowTime,
                minStakeAmount,
                dataSizeBytes,
            } = message;

            await dhService.handleOffer(
                dcWallet,
                dcId,
                dataId,
                totalEscrowTime * 60000, // in ms.
                new BN(minStakeAmount),
                new BN(dataSizeBytes),
            );
        });

        this.globalEmitter.on('offer-ended', (message) => {
            const { scId } = message;

            log.info(`Offer ${scId} has ended.`);
        });

        this.globalEmitter.on('AddedBid', (message) => {

        });

        this.globalEmitter.on('kad-bidding-won', (message) => {
            log.info('Wow I won bidding. Let\'s get into it.');
        });

        this.globalEmitter.on('eth-OfferCreated', async (eventData) => {
            log.info('eth-OfferCreated');

            const {
                offer_hash,
                DC_node_id,
                total_escrow_time,
                max_token_amount,
                min_stake_amount,
                min_reputation,
                data_hash,
                data_size,
            } = eventData;

            await dhService.handleOffer(
                offer_hash,
                DC_node_id,
                total_escrow_time * 60000, // In ms.
                max_token_amount,
                min_stake_amount,
                min_reputation,
                data_size,
                data_hash,
                false,
            );
        });

        this.globalEmitter.on('eth-AddedPredeterminedBid', async (eventData) => {
            log.info('eth-AddedPredeterminedBid');

            const {
                offer_hash,
                DH_wallet,
                DH_node_id,
                total_escrow_time,
                max_token_amount,
                min_stake_amount,
                data_size,
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
                    offer_hash,
                },
            });

            if (!createOfferEventEventModel) {
                log.warn(`Couldn't find event CreateOffer for offer ${offer_hash}.`);
                return;
            }

            try {
                const createOfferEvent = createOfferEventEventModel.get({ plain: true });
                const createOfferEventData = JSON.parse(createOfferEvent.data);

                await dhService.handleOffer(
                    offer_hash,
                    createOfferEventData.DC_node_id.substring(2, 42),
                    total_escrow_time * 60000, // In ms.
                    max_token_amount,
                    min_stake_amount,
                    createOfferEventData.min_reputation,
                    data_size,
                    createOfferEventData.data_hash,
                    true,
                );
            } catch (error) {
                log.error(`Failed to handle predetermined bid. ${error}.`);
            }
        });

        this.globalEmitter.on('eth-offer-canceled', (event) => {
            log.info('eth-offer-canceled');
        });

        this.globalEmitter.on('eth-bid-taken', (event) => {
            log.info('eth-bid-taken');

            const {
                DC_wallet,
                DC_node_id,
                data_id,
                total_escrow_time,
                min_stake_amount,
                data_size,
            } = event.returnValues;
        });
    }

    emit(event, ...args) {
        this.globalEmitter.emit(event, ...args);
    }
}

module.exports = EventEmitter;

