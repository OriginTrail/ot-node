const Command = require('../../command');
const { ERROR_TYPE, HANDLER_ID_STATUS } = require('../../../constants/constants');

class LocalResolveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.handlerIdService = ctx.handlerIdService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.dataService = ctx.dataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId, assertionId } = command.data;
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVING_ASSERTION,
        );

        try {
            let nquads = await this.tripleStoreModuleManager.resolve(assertionId, true);
            if (nquads.length) {
                nquads = await this.dataService.toNQuads(nquads, 'application/n-quads');

                await this.handlerIdService.cacheHandlerIdData(handlerId, nquads);
                await this.handlerIdService.updateHandlerIdStatus(
                    handlerId,
                    HANDLER_ID_STATUS.COMPLETED,
                );

                return Command.empty();
            }
        } catch (e) {
            await this.handleError(handlerId, e.message, ERROR_TYPE.LOCAL_RESOLVE_ERROR, true);
        }

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
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = LocalResolveCommand;
