const Command = require('../../../command');
const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

class LocalResolveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.handlerIdService = ctx.handlerIdService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.resolveService = ctx.resolveService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId, assertionId, ual } = command.data;
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_LOCAL_START,
        );

        const nquads = await this.resolveService.localResolve(ual, assertionId, handlerId);

        if (nquads.metadata.length && nquads.data.length) {
            await this.handlerIdService.cacheHandlerIdData(handlerId, nquads);
            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.RESOLVE.RESOLVE_LOCAL_END,
            );
            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.RESOLVE.RESOLVE_END,
            );

            return Command.empty();
        }

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_LOCAL_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default localResolveCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localResolveCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.LOCAL_RESOLVE_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = LocalResolveCommand;
