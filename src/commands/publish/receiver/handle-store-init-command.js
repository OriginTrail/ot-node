const Command = require('../../command');
const constants = require('../../../constants/constants');
const { NETWORK_PROTOCOLS } = require('../../../constants/constants');

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
        const { remotePeerId, handlerId } = command.data;

        // todo add message validation assertionId

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            constants.NETWORK_PROTOCOLS.STORE,
            remotePeerId,
            messageType,
            handlerId,
            messageData,
        );

        return Command.empty();
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        this.logger.error({
            msg: errorMessage,
        });

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.STORE,
            commandData.remotePeerId,
            messageType,
            handlerId,
            messageData,
        );
        return Command.empty();
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
