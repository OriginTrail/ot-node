const Command = require('../command');
const constants = require('../../constants/constants');

class HandleStoreInitCommand extends Command {
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
        const { message, remotePeerId, stream, operationId} = command.data;

        const response = {
            header: {
                sessionId: message.header.sessionId,
                messageType: 'PROTOCOL_INIT_ACK'
            },
            data: {

            }
        }

        await this.networnetworkModuleManagerkService.sendMessageResponse(constants.NETWORK_PROTOCOLS.STORE, remotePeerId, stream, response).catch((e) => {
            this.handleError(
                operationId,
                e,
                `Error while sending store init response to node ${remotePeerId._idB58String}. Error message: ${e.message}. ${e.stack}`,
            );
        });

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
            Event_name: constants.ERROR_TYPE.HANDLE_STORE_INIT_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleStoreInitCommand;
