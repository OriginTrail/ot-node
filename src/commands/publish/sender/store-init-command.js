const { v4: uuidv4 } = require('uuid');
const { setTimeout } = require('timers/promises');
const Command = require('../../command');
const Models = require('../../../../models/index');
const {
    REMOVE_SESSION_COMMAND_DELAY,
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
    STORE_MAX_TRIES,
    STORE_BUSY_REPEAT_INTERVAL_IN_MILLS,
    STORE_MIN_SUCCESS_RATE,
    ERROR_TYPE,
} = require('../../../constants/constants');

class StoreInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.fileService = ctx.fileService;
        this.handlerIdService = ctx.handlerIdService;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { nodes, handlerId, documentPath } = command.data;

        const { assertion } = await this.fileService.loadJsonFromFile(documentPath);

        const messages = nodes.map(() => ({
            header: {
                sessionId: uuidv4(),
                messageType: NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT,
            },
            data: {
                assertionId: assertion.id,
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
                let tries = 0;
                let response;
                do {
                    if (tries !== 0)
                        await setTimeout(STORE_BUSY_REPEAT_INTERVAL_IN_MILLS);

                    response = await this.networkModuleManager.sendMessage(
                        NETWORK_PROTOCOLS.STORE,
                        node,
                        messages[index],
                    );
                    tries += 1;
                } while (
                    response &&
                    response.header.messageType === NETWORK_MESSAGE_TYPES.RESPONSES.BUSY &&
                    tries < STORE_MAX_TRIES
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
                    `Error while sending store init message to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`,
                );
            }
        });

        await Promise.allSettled(sendMessagePromises);

        const maxFailedResponses = Math.round((1 - STORE_MIN_SUCCESS_RATE) * nodes.length);
        const status = failedResponses <= maxFailedResponses ? 'COMPLETED' : 'FAILED';

        if (status === 'FAILED') {
            await this.handlerIdService.updateFailedHandlerId(
                handlerId,
                'Unable to publish data, not enough nodes available to store the data!',
            );

            if (command.data.isTelemetry) {
                await Models.assertions.create({
                    hash: assertion.id,
                    topics: JSON.stringify(assertion.metadata.keywords[0]),
                    created_at: assertion.metadata.timestamp,
                    triple_store: this.config.graphDatabase.implementation,
                    status,
                });
            }

            return Command.empty();
        }

        const commandData = command.data;
        commandData.nodes = availableNodes;
        commandData.sessionIds = sessionIds;

        return this.continueSequence(commandData, command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        return Command.empty();
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.STORE_INIT_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default storeInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'storeInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = StoreInitCommand;
