const logger = require('../../modules/logger');
const GraphStorage = require('../../modules/Database/GraphStorage');
const DatasetPruningService = require('../../modules/service/dataset-pruning-service');

process.on('message', async (data) => {
    const {
        selectedDatabase, importedPruningDelayInMinutes, replicatedPruningDelayInMinutes,
    } = JSON.parse(data);
    try {
        const graphStorage = new GraphStorage(selectedDatabase, logger);
        const datasetPruningService = new DatasetPruningService({ logger, graphStorage });
        await datasetPruningService
            .pruneDatasets(
                importedPruningDelayInMinutes,
                replicatedPruningDelayInMinutes,
            );

        process.send('Finalized');
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
