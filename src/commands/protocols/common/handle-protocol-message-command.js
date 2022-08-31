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

        try {
            const { messageType, messageData } = await this.prepareMessage(command.data);
            await this.networkModuleManager.sendMessageResponse(
                this.operationService.getNetworkProtocol(),
                remotePeerId,
                messageType,
                operationId,
                keywordUuid,
                messageData,
            );
        } catch (error) {
            if (command.retries) {
                this.logger.warn(error.message);
                return Command.retry();
            }
            await this.handleError(error.message, command);
        }

        return Command.empty();
    }

    async prepareMessage() {
        // overridden by subclasses
    }

    async handleError(errorMessage, command) {
        const { operationId, remotePeerId, keywordUuid } = command.data;

        await super.handleError(operationId, errorMessage, this.errorType, true);
        await this.networkModuleManager.sendMessageResponse(
            this.operationService.getNetworkProtocol(),
            remotePeerId,
            NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            operationId,
            keywordUuid,
            {},
        );
    }
}

module.exports = HandleProtocolMessageCommand;
