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
     * @param err
     */
    async recover(command, err) {
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
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
