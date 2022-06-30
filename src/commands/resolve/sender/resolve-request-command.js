const ProtocolRequestCommand = require('../../common/protocol-request-command');
const Command = require('../../command');
const {
    ERROR_TYPE,
    NETWORK_PROTOCOLS,
    RESOLVE_REQUEST_STATUS,
    RESOLVE_STATUS,
} = require('../../../constants/constants');

class ResolveRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.resolveService = ctx.resolveService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.commandName = 'resolveRequestCommand';
        this.errorType = ERROR_TYPE.RESOLVE_REQUEST_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.RESOLVE;
    }

    async shouldSendMessage(command) {
        const { handlerId } = command.data;

        const resolve = await this.repositoryModuleManager.getResolveStatus(handlerId);

        if (resolve.status === RESOLVE_STATUS.IN_PROGRESS) {
            return true;
        }
        this.logger.trace(
            `Resolve request command skipped for publish with handlerId: ${handlerId} with status ${resolve.status}`,
        );
        return false;
    }

    async prepareMessage(command) {
        const { ual, assertionId } = command.data;

        return { ual, assertionId };
    }

    async handleAck(command, responseData) {
        await this.resolveService.processResolveResponse(
            command,
            RESOLVE_REQUEST_STATUS.COMPLETED,
            responseData,
        );
        return Command.empty();
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.resolveService.processResolveResponse(
            command,
            RESOLVE_REQUEST_STATUS.FAILED,
            null,
            errorMessage,
        );
    }

    async retryFinished(command) {
        await this.markResponseAsFailed(
            command,
            'Max number of retries for protocol resolve request message reached',
        );
    }

    /**
     * Builds default resolveRequest
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'resolveRequestCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveRequestCommand;
