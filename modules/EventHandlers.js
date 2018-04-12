const globalEvents = require('./GlobalEvents');
const importer = require('./importer')();
const MessageHandler = require('./MessageHandler');
const Storage = require('./Database/SystemStorage');
const Blockchain = require('./BlockChainInstance');
const Graph = require('./Graph');
const replication = require('./DataReplication');
const deasync = require('deasync-promise');
const Challenge = require('./Challenge');

const { globalEmitter } = globalEvents;
const log = require('./Utilities').getLogger();

globalEmitter.on('import-request', (data) => {
    importer.importXML(data.filepath, (response) => {
        // emit response
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
                /*  Blockchain.bc.writeRootHash(data_id, root_hash).then((res) => {
                    log.info('Fingerprint written on blockchain');
                }).catch((e) => {
                    // console.log('Error: ', e);
                }) */
                Graph.encryptVertices(
                    '0x1a2C6214dD5A52f73Cb5C8F82ba513DA1a0C8fcE',
                    '27a975a7fb6a177c9af38c155b17208948cb8776',
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

globalEmitter.on('replication-request', (data) => {

});

globalEmitter.on('payload-request', (data) => {
    importer.importJSON(data.payload)
        .then(() => {
            MessageHandler.sendDirectMessage(data.contact, 'replication-finished', 'success');
        });
});

globalEmitter.on('replication-finished', (status) => {
    if (status === 'success') {
        // start challenging
    }
});

globalEmitter.on('challenge-request', (data) => {
    const challenge = data.post_body;

    // TODO doktor: Check for data.
    const answer = Challenge.answerTestQuestion(challenge.block_id, null, null);

    data.res.send({
        status: 200,
        answer,
    });
});
