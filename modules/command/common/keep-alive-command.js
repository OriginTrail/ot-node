const { v1: uuidv1 } = require('uuid');
const Command = require('../command');

class KeepAliveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { message } = command.data;

        const Id_operation = uuidv1();
        this.logger.emit({
            msg: message, Event_name: 'keep_alive', Operation_name: 'KeepAlive', Id_operation,
        });

        return Command.repeat();
    }

    /**
     * Builds default dcConvertToOtJsonCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'keepAliveCommand',
            delay: 0,
            data: {
                message: 'OT-Node is alive...',
            },
            period: 1 * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = KeepAliveCommand;
