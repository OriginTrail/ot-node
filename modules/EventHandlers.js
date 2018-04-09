const globalEvents = require('./GlobalEvents');
const importer = require('./importer')();
const MessageHandler = require('./MessageHandler');
const Storage = require('./Storage');
const Blockchain = require('./BlockChainInstance');
const Graph = require('./Graph');

const { globalEmitter } = globalEvents;

globalEmitter.on('import-request', (data) => {
    importer.importXML(data.filepath, (response) => {
        // emit response
    });
});
globalEmitter.on('gs1-import-request', (data) => {
    importer.importXMLgs1(data.filepath, (response) => {
        const {
            data_id, root_hash, total_documents, vertices,
        } = response;

        Storage.models.data_info.create({
            data_id,
            root_hash,
            import_timestamp: new Date(),
            total_documents,
        }).then((data_info) => {
            Blockchain.bc.writeRootHash(data_id, root_hash);

            Graph.encryptVertices(dhWallet, dhKademilaId, vertices);
            // eslint-disable-next-line global-require
            const testing = require('./testing')();

            // eslint-disable-next-line max-len
            graph.encryptVertices(config.DH_NODE_IP, config.DH_NODE_PORT, vertices, (result) => { // eslint-disable-line no-shadow
                const encryptedVertices = result;
                log.info('[DC] Preparing to enter sendPayload');

                const data = {};
                data.vertices = vertices;
                data.edges = edges;
                data.data_id = data_id;

                // eslint-disable-next-line no-shadow
                replication.sendPayload(data, (result) => {
                    log.info('[DC] Payload sent');
                    log.info('[DC] Generating tests for DH');
                });
            });
        });
    });
});

globalEmitter.on('replicaiton-request', (data) => {
    // importer.importXMLgs1(data.queryObject.filepath, (response) => {
    //     // emit response
    // });
});
