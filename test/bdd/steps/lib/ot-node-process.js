const OTNode = require('../../../../ot-node');
const HttpApiHelper = require('../../../utilities/http-api-helper');

process.on('message', async (data) => {
    const config = JSON.parse(data);
    try {
        process.env.OPERATIONAL_DB_NAME = config.operationalDatabase.databaseName;
        const newNode = new OTNode(config);
        newNode.start().then(async () => {
            let started = false;
            const httpApiHelper = new HttpApiHelper();
            while (!started) {
                try {
                    const nodeHostname = `http://localhost:${config.rpcPort}`;
                    // eslint-disable-next-line no-await-in-loop
                    await httpApiHelper.info(nodeHostname);
                    started = true;
                } catch (error) {
                    // eslint-disable-next-line no-await-in-loop
                    await setTimeout(1000);
                }
            }

            process.send({ status: 'STARTED' });
        });
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
