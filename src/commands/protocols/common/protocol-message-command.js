const Command = require('../../command');
const { NETWORK_MESSAGE_TYPES } = require('../../../constants/constants');

class ProtocolMessageCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.networkModuleManager = ctx.networkModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async executeProtocolMessageCommand(command, messageType) {
        if (!(await this.shouldSendMessage(command))) {
            return Command.empty();
        }
        const message = await this.prepareMessage(command);

        return this.sendProtocolMessage(command, message, messageType);
    }

    async shouldSendMessage(command) {
        const { handlerId } = command.data;

        const operation = await this.repositoryModuleManager.getOperationStatus(
            this.operationService.getOperationName(),
            handlerId,
        );

        if (operation.status === this.operationService.getOperationStatus().IN_PROGRESS) {
            return true;
        }
        this.logger.trace(
            `${command.name} skipped for handlerId: ${handlerId} with status ${operation.status}`,
        );

        return false;
    }

    // eslint-disable-next-line no-unused-vars
    async prepareMessage(command) {
        // overridden by store-init-command, get-init-command, search-init-command,
        //               store-request-command, get-request-command, search-request-command
    }

    async sendProtocolMessage(command, message, messageType) {
        const { node, handlerId, keyword } = command.data;

        const response = await this.networkModuleManager.sendMessage(
            this.operationService.getNetworkProtocol(),
            node,
            messageType,
            handlerId,
            keyword,
            message,
        );
        switch (response.header.messageType) {
            case NETWORK_MESSAGE_TYPES.RESPONSES.BUSY:
                return this.handleBusy(command, response.data);
            case NETWORK_MESSAGE_TYPES.RESPONSES.NACK:
                return this.handleNack(command, response.data);
            case NETWORK_MESSAGE_TYPES.RESPONSES.ACK:
                return this.handleAck(command, response.data);
            default:
                await this.markResponseAsFailed(
                    command,
                    `Received unknown message type from node during ${command.name}`,
                );
                return command.empty();
        }
    }

    async handleAck(command, responseData) {
        return this.continueSequence(command.data, command.sequence);
    }

    async handleBusy(command, responseData) {
        return Command.retry();
    }

    async handleNack(command, responseData) {
        await this.markResponseAsFailed(
            command,
            `Received NACK response from node during ${command.name}`,
        );
        return Command.empty();
    }

    async recover(command, err) {
        await this.markResponseAsFailed(command, err.message);
        return Command.empty();
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.operationService.processResponse(
            command,
            this.operationService.getOperationRequestStatus().FAILED,
            null,
            errorMessage,
        );
    }

    async retryFinished(command) {
        await this.markResponseAsFailed(
            command,
            `Max number of retries for protocol message ${command.name} reached`,
        );
    }
}

module.exports = ProtocolMessageCommand;
