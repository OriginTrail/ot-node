const OTNode = require('../../../../ot-node');

process.on('message', async (data) => {
    const config = JSON.parse(data);
    try {
        process.env.OPERATIONAL_DB_NAME = config.operationalDb.databaseName;
        const newNode = new OTNode(config);
        newNode.start().then(() => {
            process.send({ status: 'STARTED' });
        });
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
