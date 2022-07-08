const Command = require('../../../command');
const { ERROR_TYPE } = require('../../../../constants/constants');
const constants = require('../../../../constants/constants');

class HandleSearchAssertionsInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { message, remotePeerId, handlerId } = command.data;

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
            remotePeerId,
            messageType,
            handlerId,
            messageData,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.HANDLE_SEARCH_ASSERTIONS_INIT_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default handleSearchAssertionsInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleSearchAssertionsInitCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_SEARCH_ASSERTIONS_INIT_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleSearchAssertionsInitCommand;
