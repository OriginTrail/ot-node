const Command = require('../../command');
const { ERROR_TYPE } = require('../../../constants/constants');

class LocalResolveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.handlerIdService = ctx.handlerIdService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId, assertionId } = command.data;

        try {
            let nquads = await this.tripleStoreModuleManager.resolve(assertionId, true);
            if (nquads.length) {
                nquads = nquads
                    .toString()
                    .split('\n')
                    .filter((x) => x !== '');

                await this.handlerIdService.cacheHandlerIdData(handlerId, nquads);
                
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
