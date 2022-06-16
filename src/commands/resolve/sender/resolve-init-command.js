const { v4: uuidv4 } = require('uuid');
const Command = require('../../command');
const {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
    REMOVE_SESSION_COMMAND_DELAY,
} = require('../../../constants/constants');

class ResolveInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { nodes, assertionId, handlerId } = command.data;

        const messages = nodes.map(() => ({
            header: {
                sessionId: uuidv4(),
                messageType: NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT,
            },
            data: {
                assertionId,
            },
        }));

        const removeSessionPromises = messages.map((message) =>
            this.commandExecutor.add(
                {
                    name: 'removeSessionCommand',
                    sequence: [],
                    data: { sessionId: message.header.sessionId },
                    transactional: false,
                },
                REMOVE_SESSION_COMMAND_DELAY,
            ),
        );

        await Promise.all(removeSessionPromises);

        let failedResponses = 0;
        const availableNodes = [];
        const sessionIds = [];
        const sendMessagePromises = nodes.map(async (node, index) => {
            try {
                const response = await this.networkModuleManager.sendMessage(
                    NETWORK_PROTOCOLS.RESOLVE,
                    node,
                    messages[index],
                );
                if (
                    !response ||
                    response.header.messageType === NETWORK_MESSAGE_TYPES.RESPONSES.NACK ||
                    response.header.messageType === NETWORK_MESSAGE_TYPES.RESPONSES.BUSY
                ) {
                    failedResponses += 1;
                    this.networkModuleManager.removeSession(response.header.sessionId);
                } else {
                    availableNodes.push(node);
                    sessionIds.push(response.header.sessionId);
                }
            } catch (e) {
                failedResponses += 1;
                this.handleError(
                    handlerId,
                    e,
                    `Error while sending resolve init message to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`,
                );
            }
        });

        await Promise.allSettled(sendMessagePromises)
        const status = failedResponses === nodes.length ? 'FAILED' : 'COMPLETED';

        if (status === 'FAILED') {
            await this.handlerIdService.updateFailedHandlerId(
                handlerId,
                'Resolve failed, no node available!',
            );

            return Command.empty();
        }

        const commandData = command.data;
        commandData.nodes = availableNodes;
        commandData.sessionIds = sessionIds;

        return this.continueSequence(command.data, command.sequence);
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.RESOLVE_INIT_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default resolveInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'resolveInitCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.RESOLVE_INIT_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveInitCommand;
