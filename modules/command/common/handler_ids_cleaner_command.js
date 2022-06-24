const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../../src/constants/constants');

/**
 * Removes handler id entries in database and cached files
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
        Models.handler_ids.findAll({
            where: {
                timestamp: { [Models.Sequelize.Op.lt]: timeToBeDeleted },
                status: { [Models.Sequelize.Op.in]: ['COMPLETED', 'FAILED'] },
            },
        }).then((handlersToBeDeleted) => {
            handlersToBeDeleted.forEach((handler) => {
                const handlerId = handler.handler_id;
                Models.handler_ids.destroy({
                    where: {
                        handler_id: handlerId,
                    },
                }).catch((error) => {
                    this.logger.warn(`Failed to clean handler ids table: error: ${error.message}`);
                });
                const filePath = this.fileService.getHandlerIdDocumentPath(handlerId);
                this.fileService.removeFile(filePath).catch((error) => {
                    this.logger.warn(`Failed to remove handler id cache file: error: ${error.message}`);
                });
            });
        }).catch((error) => {
            this.logger.warn(`Failed to clean handler ids table: error: ${error.message}`);
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
