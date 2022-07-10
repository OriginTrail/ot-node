const Command = require('../../../command');
const { ERROR_TYPE } = require('../../../../constants/constants');
const constants = require('../../../../constants/constants');

class HandleSearchAssertionsRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { message, remotePeerId, handlerId } = command.data;

        const localQuery = true;
        const data = await this.tripleStoreModuleManager.findAssertionsByKeyword(
            message.data.query,
            message.data.options,
            localQuery,
        );

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        const messageData = data.map((assertion) => assertion.assertionId);
        await this.networkModuleManager.sendMessageResponse(
            constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
            remotePeerId,
            messageType,
            handlerId,
            messageData,
        );

        return Command.empty();
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.HANDLE_SEARCH_ASSERTIONS_REQUEST_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default handleSearchAssertionsRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleSearchAssertionsRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_SEARCH_ASSERTIONS_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleSearchAssertionsRequestCommand;