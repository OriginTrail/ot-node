const Command = require('../../command');
const constants = require('../../../constants/constants');

class HandleStoreInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { assertionId, remotePeerId, handlerId } = command.data;

        // todo add message validation assertionId

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            constants.NETWORK_PROTOCOLS.STORE,
            remotePeerId,
            messageType,
            handlerId,
            messageData
        );

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
