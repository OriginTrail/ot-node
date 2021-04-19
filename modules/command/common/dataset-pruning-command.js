const Command = require('../command');
const constants = require('../../constants');
const { fork } = require('child_process');

class DatasetPruningCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.datasetPruningService = ctx.datasetPruningService;
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

        const forked = fork('modules/worker/datasets-pruning-worker.js');

        forked.send(JSON.stringify({
            selectedDatabase: this.config.database,
            importedPruningDelayInMinutes: this.config
                .dataset_pruning.imported_pruning_delay_in_minutes,
            replicatedPruningDelayInMinutes: this.config.dataset_pruning
                .replicated_pruning_delay_in_minutes,
        }));

        forked.on('message', async (response) => {
            console.log(response);
        });
        this.logger.info('Dataset pruning completed');
        return Command.repeat();
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
