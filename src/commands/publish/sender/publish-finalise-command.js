const Command = require('../../command');
const { HANDLER_ID_STATUS, PUBLISH_REQUEST_STATUS } = require('../../../constants/constants');

class PublishFinaliseCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId } = command.data;

        this.logger.info(`Finalizing publish for handlerId: ${handlerId}`);

        const responseStatuses = await this.repositoryModuleManager.getPublishResponsesStatuses(
            handlerId,
        );
        let failedNumber = 0;
        let completedNumber = 0;

        responseStatuses.forEach((status) => {
            if (status === PUBLISH_REQUEST_STATUS.FAILED) {
                failedNumber += 1;
            } else {
                completedNumber += 1;
            }
        });

        this.logger.info(
            `Total number of responses: ${
                failedNumber + completedNumber
            }, failed: ${failedNumber}, completed: ${completedNumber}`,
        );

        await this.handlerIdService.updateHandlerIdStatus(handlerId, HANDLER_ID_STATUS.COMPLETED);

        return Command.empty();
    }

    /**
     * Builds default storeInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishFinalizeCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishFinaliseCommand;
