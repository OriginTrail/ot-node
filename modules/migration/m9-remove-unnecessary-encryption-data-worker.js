const GraphStorage = require('../Database/GraphStorage');

process.on('message', async (dataFromParent) => {
    const {
        result, database,
    } = JSON.parse(dataFromParent);
    try {
        const graphStorage = new GraphStorage(database, null);
        await graphStorage.connect();

        for (const object of result) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await graphStorage.removeUnnecessaryEncryptionData(
                    object.data_set_id,
                    object.offer_id,
                    object.encryptionColor,
                );
            } catch (e) {
                // todo add logger here
            }
        }

        process.send(JSON.stringify({ status: 'COMPLETED' }), () => {
            process.exit(0);
        });
    } catch (e) {
        process.send({ error: `${e.message}\n${e.stack}` });
    }
});

process.once('SIGTERM', () => process.exit(0));
