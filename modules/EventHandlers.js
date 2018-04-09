const globalEvents = require('./GlobalEvents');
const importer = require('./importer')();
const MessageHandler = require('./MessageHandler');
const Storage = require('./Storage');
const Blockchain = require('./BlockChainInstance');
const Graph = require('./Graph');
const replication = require('./DataReplication');

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

        Storage.models.data_info.create({
            data_id,
            root_hash,
            import_timestamp: new Date(),
            total_documents,
        }).then((data_info) => {
            console.log(data_info);
            Blockchain.bc.writeRootHash(data_id, root_hash);
            Graph.encryptVertices(
                '0x1a2C6214dD5A52f73Cb5C8F82ba513DA1a0C8fcE',
                'b8eed150d20a9d5ec553c97104fbcf420c2c28c0',
                vertices,
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
    importer.importJSON(data)
        .then(() => {
            MessageHandler.sendDirectMessage(data.contact, 'replication-finished', 'success');
        });
});

globalEmitter.on('replication-finished', (status) => {
    if (status === 'success') {
        // start challenging
    }
});
