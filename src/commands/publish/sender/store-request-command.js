const Command = require('../../command');
const Models = require('../../../../models/index');
const {
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    HANDLER_ID_STATUS,
} = require('../../../constants/constants');

class StoreRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.publishService = ctx.publishService;
        this.fileService = ctx.fileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { documentPath, handlerId, nodes, sessionIds } = command.data;

        const { nquads, assertion } = await this.fileService.loadJsonFromFile(documentPath);

        const messages = sessionIds.map((sessionId) => ({
            header: {
                sessionId,
                messageType: NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST,
            },
            data: { id: assertion.id, nquads },
        }));

        let failedResponses = 0;
        const sendMessagePromises = nodes.map(async (node, index) => {
            try {
                const response = await this.networkModuleManager.sendMessage(
                    NETWORK_PROTOCOLS.STORE,
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
                    `Error while sending data with assertion id ${assertion.id} to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`,
                );
            }
        });

        await Promise.allSettled(sendMessagePromises);

        const status =
            failedResponses === 0 ? HANDLER_ID_STATUS.COMPLETED : HANDLER_ID_STATUS.FAILED;

        await this.handlerIdService.updateFailedHandlerId(
            handlerId,
            'Publish failed, not enough nodes stored the data!',
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

        for (const sessionId of sessionIds) {
            this.networkModuleManager.removeSession(sessionId);
        }

        return this.continueSequence(command.data, command.sequence);
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
            Event_name: ERROR_TYPE.STORE_REQUEST_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default storeRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'storeRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = StoreRequestCommand;
