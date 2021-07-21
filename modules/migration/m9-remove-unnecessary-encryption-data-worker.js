const GraphStorage = require('../Database/GraphStorage');

process.on('message', async (dataFromParent) => {
    const {
        result, database,
    } = JSON.parse(dataFromParent);
    try {
        const graphStorage = new GraphStorage(database, null);
        await graphStorage.connect();

        const promises = [];
        for (const object of result) {
            promises.push(graphStorage.removeUnnecessaryEncryptionData(
                object.data_set_id,
                object.offer_id,
                object.encryptionColor,
            ));
        }

        await Promise.all(promises);

        process.send(JSON.stringify({ status: 'COMPLETED' }), () => {
            process.exit(0);
        });
    } catch (e) {
        process.send({ error: `${e.message}\n${e.stack}` });
    }
});

process.once('SIGTERM', () => process.exit(0));
