const { v4: uuidv4 } = require('uuid');
const Command = require('../../command');
const constants = require('../../../constants/constants');

class StoreInitCommand extends Command {
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
        const { nodes, handlerId } = command.data;

        const messages = nodes.map(() => ({
            header: {
                sessionId: uuidv4(),
                messageType: 'PROTOCOL_INIT',
            },
            data: {},
        }));

        const sendMessagePromises = nodes.map((node, index) =>
            this.networkModuleManager
                .sendMessage(constants.NETWORK_PROTOCOLS.STORE, node, messages[index])
                .catch((e) => {
                    this.handleError(
                        handlerId,
                        e,
                        `Error while sending store init message to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`,
                    );
                }),
        );

        const responses = await Promise.all(sendMessagePromises);

        const commandData = command.data;

        const sessionIds = [];
        for (const response of responses) {
            sessionIds.push(response.header.sessionId);
        }
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
            Event_name: constants.ERROR_TYPE.STORE_INIT_COMMAND,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default sendAssertionCommand
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
