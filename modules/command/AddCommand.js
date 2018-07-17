const Command = require('./Command');

class AddCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
    }

    /**
     * Executes ADD operation
     * @param event
     * @param transaction
     */
    async execute(event, transaction) {
        const { id, data } = event;
        const { prev, value } = data;

        const sum = prev + value;
        this.logger.info(`Got result ${prev + value}`);
        const { sequence } = event;
        if (sequence) {
            return this.continueSequence({
                prev,
                value: sum,
            }, sequence);
        }
        return {
            commands: [{
                name: 'check',
                data: {
                },
                period: 2000,
                deadline: Date.now() + 20000,
                parent: id,
                delay: 5000,
            }],
        };
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'add',
            delay: 0,
            deadline: Date.now() + 10000,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = AddCommand;
