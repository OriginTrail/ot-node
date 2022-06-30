const Command = require('../../command');
const {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
    HANDLER_ID_STATUS,
} = require('../../../constants/constants');

class HandleResolveInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.networkModuleManager = ctx.networkModuleManager;

        this.resolveService = ctx.resolveService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId, handlerId } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.ASSERTION_EXISTS_LOCAL_START,
        );

        // TODO: validate assertionId / ual

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.ASSERTION_EXISTS_LOCAL_END,
        );

        const messageType = NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.RESOLVE,
            remotePeerId,
            messageType,
            handlerId,
            messageData,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        await this.resolveService.handleReceiverCommandError(
            handlerId,
            errorMessage,
            errorName,
            markFailed,
            commandData,
        );
        return Command.empty();
    }

    /**
     * Builds default handleResolveInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleResolveInitCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_RESOLVE_INIT_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleResolveInitCommand;
