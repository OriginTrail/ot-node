const Command = require('../../command');
const { ERROR_TYPE, NETWORK_MESSAGE_TYPES, NETWORK_PROTOCOLS} = require('../../../constants/constants');

class HandleResolveInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
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

        // TODO: validate assertionId / ual

        const messageType = NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.RESOLVE,
            remotePeerId,
            messageType,
            handlerId,
            messageData
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default handleResolveInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleResolveInitCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_RESOLVE_INIT_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleResolveInitCommand;
