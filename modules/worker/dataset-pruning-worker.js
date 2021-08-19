const logger = require('../../modules/logger');
const GraphStorage = require('../../modules/Database/GraphStorage');
const DatasetPruningService = require('../../modules/service/dataset-pruning-service');

process.on('message', async (data) => {
    const workerData = JSON.parse(data);
    const {
        selectedDatabase,
        idsForPruning,
    } = workerData;
    let { numberOfPrunedDatasets } = workerData;
    try {
        const graphStorage = new GraphStorage(selectedDatabase, logger);
        await graphStorage.connect();
        const datasetPruningService = new DatasetPruningService({ logger, graphStorage });

        if (idsForPruning.datasetsToBeDeleted.length !== 0) {
            await datasetPruningService
                .removeDatasetsFromGraphDb(idsForPruning.datasetsToBeDeleted);
            numberOfPrunedDatasets += idsForPruning.datasetsToBeDeleted.length;
        }
        idsForPruning.numberOfPrunedDatasets = numberOfPrunedDatasets;
        process.send(idsForPruning);
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
