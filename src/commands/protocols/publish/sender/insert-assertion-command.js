const Command = require('../../../command');
const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

class InsertAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.fileService = ctx.fileService;
        this.handlerIdService = ctx.handlerIdService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId, ual, assertionId } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );
        await this.operationService
            .localStore(ual, assertionId, handlerId)
            .catch((e) => this.handleError(handlerId, e.message, ERROR_TYPE.LOCAL_STORE_ERROR));
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default insertAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'insertAssertionCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.INSERT_ASSERTION_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = InsertAssertionCommand;
