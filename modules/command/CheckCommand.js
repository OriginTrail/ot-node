const Command = require('./Command');

class CheckCommand extends Command {
    /**
     * Executes ADD operation
     * @param event
     * @param transaction
     */
    async execute(event, transaction) {
        return Command.repeat();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'check',
            delay: 0,
            period: 1000,
            deadline: Date.now() + 10000,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = CheckCommand;
