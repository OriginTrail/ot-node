const Command = require('../../../command');

class SearchAssertionsCommand extends Command {
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
        const { nodes, handlerId, query, options } = command.data;

        const commandSequence = ['searchAssertionsInitCommand', 'searchAssertionsRequestCommand'];
        const addCommandPromise = [];
        nodes.forEach((node) => {
            addCommandPromise.push(
                this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: { handlerId, node, query, options },
                    transactional: false,
                }),
            );
        });

        await Promise.any(addCommandPromise);

        // todo schedule timeout command
        return Command.empty();
    }

    /**
     * Builds default searchAssertionsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'searchAssertionsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SearchAssertionsCommand;
