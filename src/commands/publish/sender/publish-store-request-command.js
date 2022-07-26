const ProtocolRequestCommand = require('../../common/protocol-request-command');
const Command = require('../../command');
const {
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    PUBLISH_REQUEST_STATUS,
    PUBLISH_STATUS,
} = require('../../../constants/constants');

class PublishStoreRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.publishService = ctx.publishService;
        this.handlerIdService = ctx.handlerIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.commandName = 'publishStoreRequestCommand';
        this.errorType = ERROR_TYPE.STORE_REQUEST_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.STORE;
    }

    async shouldSendMessage(command) {
        const { handlerId } = command.data;

        const publish = await this.repositoryModuleManager.getPublishStatus(handlerId);

        if (publish.status === PUBLISH_STATUS.IN_PROGRESS) {
            return true;
        }
        this.logger.trace(
            `Publish init command skipped for publish with handlerId: ${handlerId} with status ${publish.status}`,
        );
        return false;
    }

    async prepareMessage(command) {
        const { handlerId, assertionId, metadata, ual } = command.data;
        const { data } = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        return {
            metadata,
            data,
            assertionId,
            ual,
        };
    }

    async handleAck(command) {
        await this.publishService.processPublishResponse(command, PUBLISH_REQUEST_STATUS.COMPLETED);
        return Command.empty();
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.publishService.processPublishResponse(
            command,
            PUBLISH_REQUEST_STATUS.FAILED,
            errorMessage,
        );
    }

    async retryFinished(command) {
        await this.markResponseAsFailed(
            command,
            'Max number of retries for protocol store request message reached',
        );
    }

    /**
     * Builds default storeRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishStoreRequestCommand;
