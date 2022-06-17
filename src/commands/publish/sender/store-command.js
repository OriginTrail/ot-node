
const Command = require('../../command');

class StoreCommand extends Command {
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
        const { nodes, handlerId, assertionId } = command.data;

        const commandSequence = [
            'storeInitCommand',
            'storeRequestCommand'
        ];
        const addCommandPromise = []
        nodes.forEach((node) => {
            addCommandPromise.push(this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {handlerId, node, assertionId},
                transactional: false,
            }))
        })

        await Promise.all(addCommandPromise);

        // todo schedule timeout command
    }

    /**
     * Builds default storeInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'storeCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = StoreCommand;
