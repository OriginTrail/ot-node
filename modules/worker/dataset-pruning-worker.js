const logger = require('../../modules/logger');
const GraphStorage = require('../../modules/Database/GraphStorage');
const DatasetPruningService = require('../../modules/service/dataset-pruning-service');

process.on('message', async (data) => {
    const workerData = JSON.parse(data);
    const {
        selectedDatabase,
        importedPruningDelayInMinutes,
        replicatedPruningDelayInMinutes,
        repackedDatasets,
        lowEstimatedValueDatasetsPruning,
    } = workerData;
    let { numberOfPrunedDatasets } = workerData;
    console.log('numberOfPrunedDatasets: ', numberOfPrunedDatasets);
    try {
        const graphStorage = new GraphStorage(selectedDatabase, logger);
        await graphStorage.connect();
        const datasetPruningService = new DatasetPruningService({ logger, graphStorage });

        let idsForPruning;
        if (lowEstimatedValueDatasetsPruning) {
            console.log('************');
            console.log('starting low estimated value datasets pruning');
            console.log('************');
            idsForPruning = datasetPruningService
                .getLowEstimatedValueIdsForPruning(repackedDatasets);
        } else {
            console.log('************');
            console.log('starting standard pruning');
            console.log('************');
            idsForPruning = datasetPruningService
                .getIdsForPruning(
                    repackedDatasets,
                    importedPruningDelayInMinutes,
                    replicatedPruningDelayInMinutes,
                );
        }

        if (idsForPruning.datasetsToBeDeleted.length !== 0) {
            // await datasetPruningService
            //     .removeDatasetsFromGraphDb(idsForPruning.datasetsToBeDeleted);
            numberOfPrunedDatasets += idsForPruning.datasetsToBeDeleted.length;
        }
        idsForPruning.numberOfPrunedDatasets = numberOfPrunedDatasets;
        process.send(idsForPruning);
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
