const globalEvents = require('./GlobalEvents');
const importer = require('./importer')();
const Storage = require('./Database/SystemStorage');
const Graph = require('./Graph');
const GraphStorage = require('./GraphStorageInstance');
const replication = require('./DataReplication');
const deasync = require('deasync-promise');
const config = require('./Config');
const ProductInstance = require('./ProductInstance');
const Challenge = require('./Challenge');
const challenger = require('./Challenger');
const node = require('./Node');
const Utilities = require('./Utilities');
const DHService = require('./DHService');
const DCService = require('./DCService');

// TODO remove below after SC intro
const SmartContractInstance = require('./temp/MockSmartContractInstance');

const { globalEmitter } = globalEvents;
const log = Utilities.getLogger();

globalEmitter.on('import-request', (data) => {
    importer.importXML(data.filepath, (response) => {
        // emit response
    });
});
globalEmitter.on('trail', (data) => {
    ProductInstance.p.getTrailByQuery(data.query).then((res) => {
        data.response.send(res);
    }).catch(() => {
        log.error(`Failed to get trail for query ${data.query}`);
        data.response.send(500); // TODO rethink about status codes
    });
});
globalEmitter.on('gs1-import-request', (data) => {
    importer.importXMLgs1(data.filepath).then((response) => {
        const {
            data_id,
            root_hash,
            total_documents,
        } = response;

        deasync(Storage.connect());
        Storage.runSystemQuery('INSERT INTO data_info (data_id, root_hash, import_timestamp, total_documents) values(?, ? , ? , ?)', [data_id, root_hash, total_documents])
            .then((data_info) => {
                DCService.createOffer(data_id, root_hash, total_documents);
            });
    }).catch((e) => {
        console.log(e);
    });
});

globalEmitter.on('replication-request', (request, response) => {
    log.trace('replication-request received');

    let price;
    let importId;
    const { dataId } = request.params.message;
    const { wallet } = request.contact[1];
    // const bid = SmartContractInstance.sc.getBid(dataId, request.contact[0]);

    if (dataId) {
        // TODO: decouple import ID from data id or load it from database.
        importId = dataId;
        // ({ price } = bid);
    }

    if (!importId || !wallet) {
        const errorMessage = 'Asked replication without providing offer ID or wallet not found.';
        log.warn(errorMessage);
        response.send({ status: 'fail', error: errorMessage });
        return;
    }

    const verticesPromise = GraphStorage.db.getVerticesByImportId(importId);
    const edgesPromise = GraphStorage.db.getEdgesByImportId(importId);

    Promise.all([verticesPromise, edgesPromise]).then((values) => {
        const vertices = values[0];
        const edges = values[1];

        Graph.encryptVertices(
            wallet,
            request.contact[0],
            vertices,
            Storage,
        ).then((encryptedVertices) => {
            log.info('[DC] Preparing to enter sendPayload');
            const data = {};
            data.contact = request.contact[0];
            data.vertices = vertices;
            data.edges = edges;
            data.data_id = dataId;
            data.encryptedVertices = encryptedVertices;
            replication.sendPayload(data).then(() => {
                log.info('[DC] Payload sent');
            });
        }).catch((e) => {
            console.log(e);
        });
    });

    response.send({ status: 'succes' });
});

globalEmitter.on('payload-request', (request, response) => {
    log.trace(`payload-request arrived from ${request.contact[0]}`);
    DHService.handleImport(request.params.message.payload);

    // TODO doktor: send fail in case of fail.
});

globalEmitter.on('replication-finished', (status) => {
    log.warn('Notified of finished replication, preparing to start challenges');

    if (status === 'success') {
        challenger.startChallenging();
    }
});

globalEmitter.on('kad-challenge-request', (request, response) => {
    log.trace(`Challenge arrived: ${request.params.message.payload}`);
    const challenge = request.params.message.payload;

    GraphStorage.db.getVerticesByImportId(challenge.import_id).then((vertexData) => {
        const answer = Challenge.answerTestQuestion(challenge.block_id, vertexData, 16);
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
globalEmitter.on('bidding-broadcast', (message) => {
    log.info('bidding-broadcast received');

    const {
        dataId,
        dcId,
        dcWallet,
        totalEscrowTime,
        minStakeAmount,
        totalDocuments,
    } = message;

    DHService.handleOffer(
        dcWallet,
        dcId,
        dataId,
        totalEscrowTime,
        minStakeAmount,
        totalDocuments, // TODO think about it
    );
});

globalEmitter.on('offer-ended', (message) => {
    const { scId } = message;

    log.info(`Offer ${scId} has ended.`);

    // TODO: Trigger escrow to end bidding and notify chosen.
    const bids = SmartContractInstance.sc.choose(scId);

    bids.forEach((bid) => {
        console.log(bid);
        node.ot.biddingWon(
            { dataId: scId },
            bid.dhId, (error) => {
                if (error) {
                    log.warn(error);
                }
            },
        );
    });
});


globalEmitter.on('kad-bidding-won', (message) => {
    log.info('Wow I won bidding. Let\'s get into it.');

    const { dataId } = message.params.message;

    // Now request data to check validity of offer.

    const dcId = SmartContractInstance.sc.getDcForBid(dataId);


    node.ot.replicationRequest({ dataId }, dcId, (err) => {
        if (err) {
            log.warn(err);
        }
    });
});

globalEmitter.on('eth-offer-created', (event) => {
    log.info('eth-offer-created');
    // ( DC_wallet, DC_node_id,  data_id,  total_escrow_time,  min_stake_amount,  data_size);

    const {
        DC_wallet,
        DC_node_id,
        data_id,
        total_escrow_time,
        min_stake_amount,
        data_size,
    } = event.returnValues;

    DHService.handleOffer(
        DC_wallet,
        DC_node_id,
        data_id,
        total_escrow_time,
        min_stake_amount,
        data_size,
    );
});

globalEmitter.on('eth-offer-canceled', (event) => {
    log.info('eth-offer-canceled');
});

globalEmitter.on('eth-bid-taken', (event) => {
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

