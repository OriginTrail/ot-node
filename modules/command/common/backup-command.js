const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');
const backupScript = require('../../../scripts/auto-backup');

/**
 * Increases approval for Bidding contract on blockchain
 */
class BackupCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.backupService = ctx.backupService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        await this.backupService.run();
        // this.logger.log('BACKUP FINISHED');
        this.logger.log('Node backup finished');
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'backupCommand',
            data: {
            },
            // TODO find optimal time for backing up
            period: 45 * 1000,
            // constants.DEFAULT_COMMAND_CLEANUP_TIME_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = BackupCommand;
