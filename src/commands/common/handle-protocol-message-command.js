const Command = require('../command');

const { NETWORK_MESSAGE_TYPES } = require('../../constants/constants');

class HandleProtocolMessageCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId, handlerId } = command.data;

        const { messageType, messageData } = await this.prepareMessage(command.data);

        await this.networkModuleManager.sendMessageResponse(
            this.networkProtocol,
            remotePeerId,
            messageType,
            handlerId,
            messageData,
        );

        return Command.empty();
    }

    async prepareMessage(commandData) {
        // overridden by subclasses
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        this.logger.error({
            msg: errorMessage,
        });

        await this.networkModuleManager.sendMessageResponse(
            this.networkProtocol,
            commandData.remotePeerId,
            NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            handlerId,
            {},
        );
        return Command.empty();
    }
}

module.exports = HandleProtocolMessageCommand;
