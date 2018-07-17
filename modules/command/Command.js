class Command {
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
    }

    /**
     * Recover system from failure
     * @param command
     * @param transaction
     * @param err
     */
    async recover(command, err, transaction) {
    }

    /**
     * Execute strategy when event is too late
     * @param transaction
     * @param command
     */
    async expired(command, transaction) {
    }

    /**
     * Makes command from sequence and continues it
     * @param data
     * @param sequence
     */
    continueSequence(data, sequence) {
        if (!sequence || sequence.length === 0) {
            return {
                commands: [],
            };
        }
        const [name] = sequence;
        sequence = sequence.slice(1);
        const handler = this.ctx[`${name}Command`];
        return {
            commands: [handler.constructor.buildDefault({
                data,
                sequence,
            })],
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
