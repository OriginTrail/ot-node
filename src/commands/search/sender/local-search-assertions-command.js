const Command = require('../../command');
const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../../constants/constants');

class LocalSearchAssertionsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.handlerIdService = ctx.handlerIdService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId, query, options } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.SEARCH_ASSERTIONS.SEARCHING_ASSERTIONS,
        );

        try {

            const localQuery = true;
            const response = await this.tripleStoreModuleManager.findAssertionsByKeyword(
                query,
                options,
                localQuery
            );

            const data = {};
            data.assertions = response.map((assertion) => assertion.assertionId);

            await this.handlerIdService.cacheHandlerIdData(handlerId, data);

        } catch (e) {
            await this.handlerIdService.updateFailedHandlerId(handlerId, e.message);
        }

        return this.continueSequence(command.data, command.sequence);
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.LOCAL_SEARCH_ASSERTIONS_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default localSearchAssertionsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localSearchAssertionsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = LocalSearchAssertionsCommand;
