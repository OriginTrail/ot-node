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

        const datasets = await this.datasetPruningService.fetchDatasetData();

        const repackedDatasets = this.datasetPruningService.repackDatasets(datasets);

        const forked = fork('modules/worker/dataset-pruning-worker.js');

        forked.send(JSON.stringify({
            selectedDatabase: this.config.database,
            importedPruningDelayInMinutes: this.config
                .dataset_pruning.imported_pruning_delay_in_minutes,
            replicatedPruningDelayInMinutes: this.config.dataset_pruning
                .replicated_pruning_delay_in_minutes,
            repackedDatasets,
            numberOfPrunedDatasets: 0,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                this.logger.error(`Error while pruning datasets: ${response.error}`);
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

            // await this.datasetPruningService.removeEntriesWithId('offers', offerIdToBeDeleted);
            // await this
            // .datasetPruningService.removeEntriesWithId('data_info', dataInfoIdToBeDeleted);
            // await this.datasetPruningService.removeEntriesWithId('bids', bidIdToBeDeleted);
            await this.datasetPruningService.updatePruningHistory(datasetsToBeDeleted);
            forked.kill();

            if (this.datasetPruningService.shouldPruneLowEstimatedValueDatasets()) {
                const datasets = await this.datasetPruningService.findLowEstimatedValueDatasets();

                if (!datasets) {
                    await this.addPruningCommandToExecutor();
                    return;
                }

                const repackedDatasets = this.datasetPruningService
                    .repackLowEstimatedValueDatasets(datasets);

                forked.send(JSON.stringify({
                    selectedDatabase: this.config.database,
                    lowEstimatedValueDatasetsPruning: true,
                    repackedDatasets,
                    numberOfPrunedDatasets,
                }));
                return;
            }
            if (numberOfPrunedDatasets > 0) {
                this.logger.info(`Successfully pruned ${numberOfPrunedDatasets} datasets.`);
            }
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
