const sleep = require('sleep-async')().Promise;
const OTNode = require('../../../../ot-node');
const HttpApiHelper = require('../../../utilities/http-api-helper');

process.on('message', async (data) => {
    const config = JSON.parse(data);
    try {
        process.env.OPERATIONAL_DB_NAME = config.operationalDb.databaseName;
        process.env.OPERATIONAL_DB_PASSWORD = 'password';
        process.env.NODE_ENV = 'test';
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
                    await sleep.sleep(1000);
                }
            }

            process.send({ status: 'STARTED' });
        });
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
