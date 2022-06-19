const Command = require('../../command');
const { ERROR_TYPE } = require('../../../constants/constants');

class LocalResolveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.handlerIdService = ctx.handlerIdService;
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
            await this.handlerIdService.updateFailedHandlerId(handlerId, e.message);
        }

        return this.continueSequence(command.data, command.sequence);
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.LOCAL_RESOLVE_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
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
