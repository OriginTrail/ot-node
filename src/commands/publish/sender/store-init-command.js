const Command = require('../../command');
const {
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
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

    async execute(command) {
        const { handlerId, node, assertionId } = command.data;

        const response = await this.networkModuleManager.sendMessage(
            NETWORK_PROTOCOLS.STORE,
            node,
            NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT,
            handlerId,
            {assertionId}
        );

        switch (response.header.messageType) {
            case NETWORK_MESSAGE_TYPES.RESPONSES.BUSY:
                return command.retry();
            case NETWORK_MESSAGE_TYPES.RESPONSES.NACK:
                return this.handleNack(command);
            case NETWORK_MESSAGE_TYPES.RESPONSES.ACK:
                return command.continueSequence(command.data, command.sequence);
            default:
                return this.handleError(command);
        }
    }

    async recover(command, err) {
        await this.markResponseAsFailed(command, err.message);
        return command.empty();
    }

    async handleNack(command) {
        await this.markResponseAsFailed(command, 'Received NACK response from node during init');
        return command.empty();
    };

    async markResponseAsFailed(command, errorMessage) {
        // log and enter data in database and invalidate session
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
            period: 5000,
            retries: 3,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = StoreInitCommand;
