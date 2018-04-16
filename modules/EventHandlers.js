const globalEvents = require('./GlobalEvents');
const importer = require('./importer')();
const Storage = require('./Database/SystemStorage');
const Blockchain = require('./BlockChainInstance');
const Graph = require('./Graph');
const GraphStorage = require('./GraphStorageInstance');
const replication = require('./DataReplication');
const deasync = require('deasync-promise');
const config = require('./Config');
const ProductInstance = require('./ProductInstance');
const Challenge = require('./Challenge');
const node = require('./Node');

const { globalEmitter } = globalEvents;
const log = require('./Utilities').getLogger();

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
            vertices,
            edges,
        } = response;

        deasync(Storage.connect());
        Storage.runSystemQuery('INSERT INTO data_info (data_id, root_hash, import_timestamp, total_documents) values(?, ? , ? , ?)', [data_id, root_hash, total_documents])
            .then((data_info) => {
                Blockchain.bc.writeRootHash(data_id, root_hash).then((res) => {
                    log.info('Fingerprint written on blockchain');
                }).catch((e) => {
                    // console.log('Error: ', e);
                });


                const [contactId, contact] = node.ot.getNearestNeighbour();

                Graph.encryptVertices(
                    contact.wallet,
                    contactId,
                    vertices,
                    Storage,
                ).then((encryptedVertices) => {
                    log.info('[DC] Preparing to enter sendPayload');
                    const data = {};
                    data.vertices = vertices;
                    data.edges = edges;
                    data.data_id = data_id;
                    data.encryptedVertices = encryptedVertices;
                    replication.sendPayload(data).then(() => {
                        log.info('[DC] Payload sent');
                    });
                }).catch((e) => {
                    console.log(e);
                });
            });
    }).catch((e) => {
        console.log(e);
    });
});

globalEmitter.on('replication-request', (data, response) => {

});

globalEmitter.on('payload-request', (request, response) => {
    importer.importJSON(request.params.message.payload)
        .then(() => {
            log.warn('[DH] Replication finished');
            response.send({
                message: 'replication-finished',
                status: 'success',
            }, (err) => {
                if (err) {
                    log.error('payload-request: failed to send reply', err);
                }
            });
        });

    // TODO doktor: send fail in case of fail.
});

globalEmitter.on('replication-finished', (status, response) => {
    log.warn('Notified of finished replication, preparing to start challenges');

    if (status === 'success') {
        // TODO doktor: start challenging
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

