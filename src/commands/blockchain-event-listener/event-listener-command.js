import Command from '../command.js';
import {
    CONTRACT_EVENT_FETCH_INTERVALS,
    NODE_ENVIRONMENTS,
    ERROR_TYPE,
    COMMAND_PRIORITY,
} from '../../constants/constants.js';

class EventListenerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.errorType = ERROR_TYPE.EVENT_LISTENER_ERROR;
    }

    calculateCommandPeriod() {
        const isDevEnvironment = [NODE_ENVIRONMENTS.DEVELOPMENT, NODE_ENVIRONMENTS.TEST].includes(
            process.env.NODE_ENV,
        );

        return isDevEnvironment
            ? CONTRACT_EVENT_FETCH_INTERVALS.DEVELOPMENT
            : CONTRACT_EVENT_FETCH_INTERVALS.MAINNET;
    }

    async execute() {
        this.logger.info('Event Listener: Starting event listener command.');

        await Promise.all(
            this.blockchainModuleManager.getImplementationNames().map(async (blockchainId) => {
                const commandData = {
                    blockchainId,
                };

                // fetching 2 times
                // improve logic for processing

                return this.commandExecutor.add({
                    name: 'blockchainEventListenerCommand',
                    data: commandData,
                    transactional: false,
                    priority: COMMAND_PRIORITY.HIGHEST,
                    isBlocking: true,
                });
            }),
        );

        if (!this.blockchainModuleManager.getImplementationNames().length) {
            this.logger.error(`No blockchain implementations. OT-node shutting down...`);
            process.exit(1);
        }

        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command) {
        this.logger.warn(`Failed to execute ${command.name}. Error: ${command.message}`);

        return Command.repeat();
    }

    /**
     * Builds default eventListenerCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'eventListenerCommand',
            data: {},
            transactional: false,
            period: this.calculateCommandPeriod(),
            priority: COMMAND_PRIORITY.HIGHEST,
        };
        Object.assign(command, map);
        return command;
    }
}

export default EventListenerCommand;
