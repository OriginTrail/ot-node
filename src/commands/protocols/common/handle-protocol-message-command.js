const Command = require('../../command');

const { NETWORK_MESSAGE_TYPES } = require('../../../constants/constants');

class HandleProtocolMessageCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.operationIdService = ctx.operationIdService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId, operationId, keywordUuid } = command.data;

        const { messageType, messageData } = await this.prepareMessage(command.data);

        await this.networkModuleManager.sendMessageResponse(
            this.operationService.getNetworkProtocol(),
            remotePeerId,
            messageType,
            operationId,
            keywordUuid,
            messageData,
        );

        return Command.empty();
    }

    async prepareMessage(commandData) {
        // overridden by subclasses
    }

    async handleError(operationId, keywordUuid, errorMessage, errorName, commandData) {
        super.handleError(operationId, errorMessage, errorName, true);

        await this.networkModuleManager.sendMessageResponse(
            this.operationService.getNetworkProtocol(),
            commandData.remotePeerId,
            NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            operationId,
            keywordUuid,
            {},
        );
        return Command.empty();
    }
}

module.exports = HandleProtocolMessageCommand;
