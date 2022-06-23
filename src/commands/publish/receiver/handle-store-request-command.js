const Command = require('../../command');
const constants = require('../../../constants/constants');

class HandleStoreRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.dataService = ctx.dataService;
        this.publishService = ctx.publishService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId, handlerId, assertionId, metadata, ual } = command.data;

        const { data } = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            constants.NETWORK_PROTOCOLS.STORE,
            remotePeerId,
            messageType,
            handlerId,
            messageData,
        );
        return Command.empty();
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        await this.publishService.handleReceiverCommandError(
            handlerId,
            errorMessage,
            errorName,
            markFailed,
            commandData,
        );
        return Command.empty();
    }

    /**
     * Builds default handleStoreRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleStoreRequestCommand;
