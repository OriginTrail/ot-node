const Command = require('../command');

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
        const { remotePeerId, handlerId } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(handlerId, this.handlerIdStatusStart);

        const { messageType, messageData } = await this.prepareMessage(command.data);

        await this.handlerIdService.updateHandlerIdStatus(handlerId, this.handlerIdStatusEnd);

        await this.networkModuleManager.sendMessageResponse(
            this.networkProtocol,
            remotePeerId,
            messageType,
            handlerId,
            messageData,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    async prepareMessage(commandData) {
        // overridden by subclasses
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        /* await this.resolveService.handleReceiverCommandError(
            handlerId,
            errorMessage,
            errorName,
            markFailed,
            commandData,
        );
        return Command.empty(); */
    }
}

module.exports = HandleProtocolMessageCommand;
