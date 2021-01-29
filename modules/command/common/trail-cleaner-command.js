const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');
const path = require('path');
const fs = require('fs');

/**
 * Trail cache clean command
 */
class TrailCleanerCommand extends Command {
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
        const cacheDirectoryPath = path.join(this.config.appDataPath, 'trail_cache');
        if (!fs.existsSync(cacheDirectoryPath)) {
            return Command.repeat();
        }
        const fileList = fs.readdirSync(cacheDirectoryPath);
        fileList.forEach((fileName) => {
            const filePath = path.join(cacheDirectoryPath, fileName);
            const now = new Date();
            const createdDate = fs.lstatSync(filePath).mtime;
            if (createdDate.getTime() + constants.TRAIL_COMMAND_CLEANUP_TIME_MILLS <
                now.getTime()) {
                fs.unlinkSync(filePath);
                this.logger.trace(`Successfully removed trail cache file: ${filePath}`);
            }
        });
        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to clean trail cache. Error: ${error.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'trailCleanerCommand',
            period: constants.TRAIL_COMMAND_CLEANUP_TIME_MILLS,
            data: {},
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = TrailCleanerCommand;
