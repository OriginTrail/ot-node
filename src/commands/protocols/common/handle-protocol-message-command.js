const Command = require('../../command');

const { NETWORK_MESSAGE_TYPES } = require('../../../constants/constants');

class HandleProtocolMessageCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.handlerIdService = ctx.handlerIdService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId, handlerId, keyword } = command.data;

        const { messageType, messageData } = await this.prepareMessage(command.data);

        await this.networkModuleManager.sendMessageResponse(
            this.networkProtocol,
            remotePeerId,
            messageType,
            handlerId,
            keyword,
            messageData,
        );

        return Command.empty();
    }

    async prepareMessage(commandData) {
        // overridden by subclasses
    }

    async handleError(handlerId, keyword, errorMessage, errorName, commandData) {
        super.handleError(handlerId, errorMessage, errorName, true);

        await this.networkModuleManager.sendMessageResponse(
            this.operationService.getNetworkProtocol(),
            commandData.remotePeerId,
            NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            handlerId,
            keyword,
            {},
        );
        return Command.empty();
    }
}

module.exports = HandleProtocolMessageCommand;
