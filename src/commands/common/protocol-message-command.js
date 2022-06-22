const Command = require('../command');
const { NETWORK_MESSAGE_TYPES} = require('../../constants/constants');

class ProtocolMessageCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    async executeProtocolMessageCommand(command, messageType) {
        const message = await this.prepareMessage(command);

        return this.sendProtocolMessage(command, message, messageType);
    }

    // eslint-disable-next-line no-unused-vars
    async prepareMessage(command) {
        // overridden by store-init-command, resolve-init-command, search-init-command,
        //               store-request-command, resolve-request-command, search-request-command
    }

    async sendProtocolMessage(command, message, messageType) {
        const { node, handlerId } = command.data;

        const response = await this.networkModuleManager
            .sendMessage(
                this.networkProtocol,
                node,
                messageType,
                handlerId,
                message,
            );
        switch (response.header.messageType) {
            case NETWORK_MESSAGE_TYPES.RESPONSES.BUSY:
                return this.handleBusy(command);
            case NETWORK_MESSAGE_TYPES.RESPONSES.NACK:
                return this.handleNack(command);
            case NETWORK_MESSAGE_TYPES.RESPONSES.ACK:
                return this.handleAck(command);
            default:
                await this.markResponseAsFailed(
                    command,
                    `Received unknown message type from node during ${this.commandName}`,
                );
                return command.empty();
        }
    }

    async handleAck(command) {
        return this.continueSequence(command.data, command.sequence);
    }

    async handleBusy() {
        return Command.retry();
    }

    async handleNack(command) {
        await this.markResponseAsFailed(
            command,
            `Received NACK response from node during ${this.commandName}`,
        );
        return Command.empty();
    }

    async recover(command, err) {
        await this.markResponseAsFailed(command, err.message);
        return Command.empty();
    }

    // eslint-disable-next-line no-unused-vars
    async markResponseAsFailed(command, errorMessage) {
        // log and enter data in database and invalidate session
    }
}

module.exports = ProtocolMessageCommand;
