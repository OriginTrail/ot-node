const Command = require('../../command');
const Models = require('../../../../models/index');
const constants = require('../../../constants');

class SendAssertionCommand extends Command {
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
                messageType: constants.NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST,
            },
            data: { id: assertion.id, nquads },
        }));

        const sendMessagePromises = nodes.map((node, index) =>
            this.networkModuleManager
                .sendMessage(constants.NETWORK_PROTOCOLS.STORE, node, messages[index])
                .catch((e) => {
                    this.handleError(
                        handlerId,
                        e,
                        `Error while sending data with assertion id ${assertion.id} to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`,
                    );
                }),
        );

        const responses = await Promise.all(sendMessagePromises);

        let failedResponses = 0;
        for (const response of responses) {
            if (response.header.messageType !== constants.NETWORK_MESSAGE_TYPES.RESPONSES.ACK) {
                failedResponses += 1;
            }
        }

        const maxFailedResponses = Math.round(
            (1 - constants.STORE_MIN_SUCCESS_RATE) * nodes.length,
        );
        const status = failedResponses <= maxFailedResponses ? 'COMPLETED' : 'FAILED';

        await Models.handler_ids.update(
            {
                status,
            },
            {
                where: {
                    handler_id: handlerId,
                },
            },
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
            Event_name: constants.ERROR_TYPE.STORE_REQUEST_ERROR,
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

module.exports = SendAssertionCommand;
