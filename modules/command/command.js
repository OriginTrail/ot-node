/**
 * Describes one command handler
 */
class Command {
    constructor(ctx) {
        this.commandResolver = ctx.commandResolver;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        return Command.empty();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        return Command.empty();
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        return data;
    }

    /**
     * Unpack data from DB
     * @param data
     */
    unpack(data) {
        return data;
    }

    /**
     * Makes command from sequence and continues it
     * @param data  -  Command data
     * @param [sequence] - Optional command sequence
     * @param [opts] - Optional command options
     */
    continueSequence(data, sequence, opts) {
        if (!sequence || sequence.length === 0) {
            return Command.empty();
        }
        const [name] = sequence;
        sequence = sequence.slice(1);

        const handler = this.commandResolver.resolve(name);
        const command = handler.default();

        const commandData = command.data ? command.data : {};
        Object.assign(command, {
            data: Object.assign(commandData, data),
            sequence,
        });
        if (opts) {
            Object.assign(command, opts);
        }
        return {
            commands: [command],
        };
    }

    /**
     * Builds command
     * @param name  - Command name
     * @param data  - Command data
     * @param [sequence] - Optional command sequence
     * @param [opts] - Optional command options
     * @returns {*}
     */
    build(name, data, sequence, opts) {
        const command = this.commandResolver.resolve(name).default();
        const commandData = command.data ? command.data : {};
        Object.assign(command, {
            data: Object.assign(commandData, data),
            sequence,
        });
        if (opts) {
            Object.assign(command, opts);
        }
        return command;
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        return {
        };
    }

    /**
     * Halt execution
     * @returns {{repeat: boolean, commands: Array}}
     */
    static empty() {
        return {
            commands: [],
        };
    }

    /**
     * Returns repeat info
     * @returns {{repeat: boolean, commands: Array}}
     */
    static repeat() {
        return {
            repeat: true,
        };
    }
}

module.exports = Command;
