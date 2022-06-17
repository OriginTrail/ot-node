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

    async execute(command) {
        const { handlerId, node, assertionId } = command.data;

        const response = await this.networkModuleManager.sendMessage(
            NETWORK_PROTOCOLS.STORE,
            node,
            NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST,
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
        return this.handleError(command, err);
    }

    async handleError(command, err) {
        await this.markResponseAsFailed(command, err.message);
        return command.empty();
    };

    async handleNack(command) {
        await this.markResponseAsFailed(command, 'Received NACK response from node during init');
        return command.empty();
    };

    async markResponseAsFailed(command, errorMessage) {
        // log and enter data in database
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
