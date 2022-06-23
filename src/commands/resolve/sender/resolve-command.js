const Command = require('../../command');

const { HANDLER_ID_STATUS } = require('../../../constants/constants');

class ResolveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { nodes, handlerId, assertionId, resolveId } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVING_ASSERTION,
        );

        const commandSequence = ['resolveInitCommand', 'resolveRequestCommand'];
        const addCommandPromise = [];
        nodes.forEach((node) => {
            addCommandPromise.push(
                this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: { handlerId, node, assertionId, resolveId },
                    transactional: false,
                }),
            );
        });

        await Promise.any(addCommandPromise);

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
