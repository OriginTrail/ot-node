const Command = require('../command');
const constants = require('../../constants');
const { fork } = require('child_process');

class DatasetPruningCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.datasetPruningService = ctx.datasetPruningService;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        if (!this.config.dataset_pruning.enabled) {
            this.logger.debug('Dataset pruning command ignored.');
            return Command.empty();
        }
        this.logger.trace('Dataset pruning command started. This command will work in background and will try to remove expired and low estimated value datasets.');
        const datasets = await this.datasetPruningService.fetchDatasetData();

        const repackedDatasets = this.datasetPruningService.repackDatasets(datasets);

        const idsForPruning = this.datasetPruningService
            .getIdsForPruning(
                repackedDatasets,
                this.config
                    .dataset_pruning.imported_pruning_delay_in_minutes,
                this.config.dataset_pruning
                    .replicated_pruning_delay_in_minutes,
            );
        const forked = fork('modules/worker/dataset-pruning-worker.js');
        if (idsForPruning.datasetsToBeDeleted.length !== 0) {
            this.logger.trace(`Removing ${idsForPruning.datasetsToBeDeleted.length} expired datasets.`);
        }
        forked.send(JSON.stringify({
            selectedDatabase: this.config.database,
            idsForPruning,
            numberOfPrunedDatasets: 0,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                this.logger.error(`Error while pruning datasets. Error message: ${response.error.message}. Pruning command will be executed again in ${constants.DATASET_PRUNING_COMMAND_TIME_MILLS / (1000 * 60 * 60 * 24)} hours`);
                forked.kill();
                await this.addPruningCommandToExecutor();
                return;
            }
            const {
                offerIdToBeDeleted,
                dataInfoIdToBeDeleted,
                datasetsToBeDeleted,
                bidIdToBeDeleted,
                numberOfPrunedDatasets,
            } = response;

            await this.datasetPruningService.removeEntriesWithId('offers', offerIdToBeDeleted);
            await this.datasetPruningService.removeEntriesWithId('data_info', dataInfoIdToBeDeleted);
            await this.datasetPruningService.removeEntriesWithId('bids', bidIdToBeDeleted);
            await this.datasetPruningService.updatePruningHistory(datasetsToBeDeleted);

            if (this.datasetPruningService.shouldPruneLowEstimatedValueDatasets()) {
                const datasets = await this.datasetPruningService.findLowEstimatedValueDatasets();

                if (!datasets) {
                    forked.kill();
                    await this.addPruningCommandToExecutor();
                    return;
                }

                const repackedDatasets = this.datasetPruningService
                    .repackLowEstimatedValueDatasets(datasets);
                const idsForPruning = this.datasetPruningService
                    .getLowEstimatedValueIdsForPruning(repackedDatasets);

                if (idsForPruning.datasetsToBeDeleted.length !== 0) {
                    this.logger.trace(`Removing ${idsForPruning.datasetsToBeDeleted.length} low estimated value datasets.`);
                    forked.send(JSON.stringify({
                        selectedDatabase: this.config.database,
                        idsForPruning,
                        numberOfPrunedDatasets,
                    }));
                    return;
                }
            }
            if (numberOfPrunedDatasets > 0) {
                this.logger.info(`Successfully pruned ${numberOfPrunedDatasets} datasets.`);
            } else {
                this.logger.info('Found 0 datasets for pruning');
            }
            forked.kill();
            await this.addPruningCommandToExecutor();
        });
        this.logger.trace('Dataset pruning worker started');
        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        this.logger.error(`There was an error during pruning process: ${err.message}. Next pruning command rescheduled.`);
        return Command.repeat();
    }

    async addPruningCommandToExecutor() {
        await this.commandExecutor.add({
            name: 'datasetPruningCommand',
            delay: constants.DATASET_PRUNING_COMMAND_TIME_MILLS,
            period: constants.DATASET_PRUNING_COMMAND_TIME_MILLS,
            transactional: false,
            data: {
            },
        });
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'datasetPruningCommand',
            data: {
            },
            period: constants.DATASET_PRUNING_COMMAND_TIME_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DatasetPruningCommand;
