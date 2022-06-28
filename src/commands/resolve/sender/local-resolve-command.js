const Command = require('../../command');
const { HANDLER_ID_STATUS } = require('../../../constants/constants');

class LocalResolveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.handlerIdService = ctx.handlerIdService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.commandExecutor = ctx.commandExecutor;
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
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_LOCAL_START,
        );

        const nquads = {
            metadata: [],
            data: [],
        };
        const resolvePromises = [
            this.tripleStoreModuleManager
                .resolve(`${assertionId}#metadata`, true)
                .then((resolved) => {
                    nquads.metadata = resolved;
                }),
            this.tripleStoreModuleManager.resolve(`${assertionId}#data`, true).then((resolved) => {
                nquads.data = resolved;
            }),
        ];

        await Promise.allSettled(resolvePromises);

        if (nquads.metadata && nquads.metadata.length && nquads.data && nquads.data.length) {
            try {
                const normalizeNquadsPromises = [
                    this.dataService
                        .toNQuads(nquads.metadata, 'application/n-quads')
                        .then((normalized) => {
                            nquads.metadata = normalized;
                        }),
                    this.dataService
                        .toNQuads(nquads.data, 'application/n-quads')
                        .then((normalized) => {
                            nquads.data = normalized;
                        }),
                ];

                await Promise.all(normalizeNquadsPromises);

                const updateHandlerIdDataPromises = [
                    this.handlerIdService.cacheHandlerIdData(handlerId, nquads),
                    this.handlerIdService.updateHandlerIdStatus(
                        handlerId,
                        HANDLER_ID_STATUS.RESOLVE.RESOLVE_LOCAL_END,
                    ),
                    this.handlerIdService.updateHandlerIdStatus(
                        handlerId,
                        HANDLER_ID_STATUS.RESOLVE.RESOLVE_END,
                    ),
                ];

                await Promise.all(updateHandlerIdDataPromises);

                return Command.empty();
            } catch (e) {
                await this.handlerIdService.updateHandlerIdStatus(
                    handlerId,
                    HANDLER_ID_STATUS.FAILED,
                    e.message,
                );
                return Command.empty();
            }
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
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = LocalResolveCommand;
