const path = require('path');
const fs = require('fs');
const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Increases approval for Bidding contract on blockchain
 */
class HandlerIdsCleanerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const timeToBeDeleted = Date.now() - constants.HANDLER_IDS_COMMAND_CLEANUP_TIME_MILLS;
        await Models.handler_ids.destroy({
            where: {
                timestamp: { [Models.Sequelize.Op.lt]: timeToBeDeleted },
                status: { [Models.Sequelize.Op.in]: ['COMPLETED', 'FAILED'] },
            },
        });

        const cacheDirectoryPath = this.fileService.getHandlerIdCachePath();
        if (!fs.existsSync(cacheDirectoryPath)) {
            return Command.repeat();
        }
        const fileList = fs.readdirSync(cacheDirectoryPath);
        fileList.forEach((fileName) => {
            const filePath = path.join(cacheDirectoryPath, fileName);
            const now = new Date();
            const createdDate = fs.lstatSync(filePath).mtime;
            if (createdDate.getTime() + constants.HANDLER_IDS_COMMAND_CLEANUP_TIME_MILLS
                < now.getTime()) {
                fs.unlinkSync(filePath);
                this.logger.trace(`Successfully removed handler id cache file: ${filePath}`);
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
        this.logger.warn(`Failed to clean handler ids table: error: ${error.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handlerIdsCleanerCommand',
            period: constants.HANDLER_IDS_COMMAND_CLEANUP_TIME_MILLS,
            data: {},
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandlerIdsCleanerCommand;
