const Command = require('../../command');

const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../../constants/constants');

class ResolveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.handlerIdService = ctx.handlerIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.RESOLVE_START_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { nodes, handlerId, ual, assertionId, numberOfFoundNodes, leftoverNodes } =
            command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_FETCH_FROM_NODES_START,
        );

        const commandSequence = ['resolveInitCommand', 'resolveRequestCommand'];
        const addCommandPromise = [];
        nodes.forEach((node) => {
            addCommandPromise.push(
                this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: {
                        handlerId,
                        node,
                        ual,
                        assertionId,
                        numberOfFoundNodes,
                        leftoverNodes,
                        numberOfNodesInBatch: nodes.length,
                    },
                    period: 5000,
                    retries: 3,
                    transactional: false,
                }),
            );
        });

        await Promise.all(addCommandPromise);

        // todo schedule timeout command

        return Command.empty();
    }

    /**
     * Builds default resolveCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'resolveCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveCommand;
