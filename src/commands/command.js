import { OPERATION_ID_STATUS } from '../constants/constants.js';

/**
 * Describes one command handler
 */
class Command {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.commandResolver = ctx.commandResolver;
        this.operationIdService = ctx.operationIdService;
    }

    /**
     * Executes command and produces one or more events
     */
    async execute() {
        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { operationId, blockchain } = command.data;
        await this.handleError(operationId, blockchain, err.message, this.errorType, true);

        return Command.empty();
    }

    /**
     * Execute strategy when event is too late
     */
    async expired() {
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
        const newSequence = sequence.slice(1);

        const handler = this.commandResolver.resolve(name);
        const command = handler.default();

        const commandData = command.data ? command.data : {};
        Object.assign(command, {
            data: Object.assign(commandData, data),
            sequence: newSequence,
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

    async retryFinished(command) {
        this.logger.trace(`Max retry count for command: ${command.name} reached!`);
    }

    /**
     * Error handler for command
     * @param operationId  - Operation operation id
     * @param error  - Error object
     * @param errorName - Name of error
     * @param markFailed - Update operation status to failed
     * @returns {*}
     */
    async handleError(operationId, blockchain, errorMessage, errorName, markFailed) {
        this.logger.error(`Command error (${errorName}): ${errorMessage}`);
        if (markFailed) {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.FAILED,
                errorMessage,
                errorName,
            );
        }
    }

    /**
     * Builds default command
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default() {
        return {};
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

    /**
     * Returns retry info
     * @returns {{retry: boolean, commands: Array}}
     */
    static retry() {
        return {
            retry: true,
        };
    }
}

export default Command;
