const Command = require('../../command');
const {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
} = require('../../../constants/constants');

class HandleResolveRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { assertionId, remotePeerId, handlerId } = command.data;

        const nquads = await this.tripleStoreModuleManager
            .resolve(assertionId)
            .catch((e) =>
                this.handleError(
                    handlerId,
                    e.message,
                    ERROR_TYPE.HANDLE_RESOLVE_REQUEST_ERROR,
                    true,
                ),
            );

        let messageType;
        let messageData;
        if (nquads && nquads.length > 0) {
            this.logger.info(`Number of n-quads retrieved from the database is ${nquads.length}`);
            messageType = NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
            messageData = { nquads };
        } else {
            messageType = NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
            messageData = {};
        }

        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.RESOLVE,
            remotePeerId,
            messageType,
            handlerId,
            messageData,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default handleResolveRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleResolveRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_RESOLVE_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleResolveRequestCommand;
