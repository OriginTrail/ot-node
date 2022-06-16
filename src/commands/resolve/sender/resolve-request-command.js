const Command = require('../../command');
const {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
    HANDLER_ID_STATUS,
} = require('../../../constants/constants');

class ResolveRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { assertionId, handlerId, nodes, sessionIds } = command.data;

        const messages = sessionIds.map((sessionId) => ({
            header: {
                sessionId,
                messageType: NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST,
            },
            data: { assertionId },
        }));

        let failedResponses = 0;
        const sendMessagePromises = nodes.map(async (node, index) => {
            try {
                const response = await this.networkModuleManager.sendMessage(
                    NETWORK_PROTOCOLS.RESOLVE,
                    node,
                    messages[index],
                );
                if (
                    !response ||
                    response.header.messageType !== NETWORK_MESSAGE_TYPES.RESPONSES.ACK
                )
                    failedResponses += 1;
            } catch (e) {
                failedResponses += 1;
                this.handleError(
                    handlerId,
                    e,
                    `Error while sending resolve request for assertion id ${assertionId} to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`,
                );
            }
        });

        const nquads = await Promise.any(sendMessagePromises);

        const status =
            failedResponses < nodes.length ? HANDLER_ID_STATUS.COMPLETED : HANDLER_ID_STATUS.FAILED;

        if (status === HANDLER_ID_STATUS.FAILED) {
            await this.handlerIdService.updateFailedHandlerId(
                handlerId,
                'Resolve failed, no node returned the requested assertion!',
            );

            return Command.empty();
        }

        try {
            await this.handlerIdService.cacheHandlerIdData(handlerId, nquads);
            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.COMPLETED,
            );
        } catch (e) {
            await this.handlerIdService.updateFailedHandlerId(handlerId, e.message);
        }

        return this.continueSequence(command.data, command.sequence);
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.RESOLVE_REQUEST_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default resolveRequest
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'resolveRequest',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.RESOLVE_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveRequestCommand;
