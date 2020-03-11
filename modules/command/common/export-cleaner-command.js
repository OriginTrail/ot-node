const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');
const path = require('path');
const fs = require('fs');

/**
 * Increases approval for Bidding contract on blockchain
 */
class ExportCleanerCommand extends Command {
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
        const cacheDirectoryPath = path.join(this.config.appDataPath, 'export_cache');

        const fileList = fs.readdirSync(cacheDirectoryPath);
        fileList.forEach((fileName) => {
            const filePath = cacheDirectoryPath + fileName;
            const now = new Date();
            const createdDate = fs.lstatSync(filePath).mtime;
            if (now.getTime() + constants.EXPORT_COMMAND_CLEANUP_TIME_MILLS <
                createdDate.getTime()) {
                this.logger.trace(`Removing export cache file: ${filePath}`);
                fs.unlinkSync(filePath);
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
        this.logger.warn(`Failed to clean export cache: error: ${error.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'exportCleanerCommand',
            period: constants.EXPORT_COMMAND_CLEANUP_TIME_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ExportCleanerCommand;
