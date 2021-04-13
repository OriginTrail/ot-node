const Command = require('../command');
const constants = require('../../constants');

class DatasetPruningCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        if (!this.config.autoUpdater.enabled) {
            this.logger.debug('Dataaset pruning command ignored.');
            return Command.repeat();
        }

        this.logger.info('Dataaset pruning command initiated');


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
