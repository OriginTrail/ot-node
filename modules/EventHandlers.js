const globalEvents = require('./GlobalEvents');
const importer = require('./importer')();
const MessageHandler = require('./MessageHandler');

const { globalEmitter } = globalEvents;

globalEmitter.on('import-request', (data) => {
    importer.importXML(data.filepath, (response) => {
        // emit response
    });
});
globalEmitter.on('gs1-import-request', (data) => {
    importer.importXMLgs1(data.filepath, (response) => {
        // emit response
    });
});

globalEmitter.on('replicaiton-request', (data) => {
    // importer.importXMLgs1(data.queryObject.filepath, (response) => {
    //     // emit response
    // });
});
