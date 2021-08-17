const logger = require('../../modules/logger');
const GraphStorage = require('../../modules/Database/GraphStorage');
const DatasetPruningService = require('../../modules/service/dataset-pruning-service');

process.on('message', async (data) => {
    const {
        selectedDatabase,
        importedPruningDelayInMinutes,
        replicatedPruningDelayInMinutes,
        repackedDatasets,
        lowEstimatedValueDatasetsPruning,
    } = JSON.parse(data);
    try {
        const graphStorage = new GraphStorage(selectedDatabase, logger);
        await graphStorage.connect();
        const datasetPruningService = new DatasetPruningService({ logger, graphStorage });

        let idsForPruning;
        if (lowEstimatedValueDatasetsPruning) {
            idsForPruning = datasetPruningService
                .getLowEstimatedValueIdsForPruning(repackedDatasets);
        } else {
            idsForPruning = datasetPruningService
                .getIdsForPruning(
                    repackedDatasets,
                    importedPruningDelayInMinutes,
                    replicatedPruningDelayInMinutes,
                );
        }

        if (idsForPruning.datasetsToBeDeleted.length !== 0) {
            await datasetPruningService
                .removeDatasetsFromGraphDb(idsForPruning.datasetsToBeDeleted);
        }
        process.send(idsForPruning);
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
