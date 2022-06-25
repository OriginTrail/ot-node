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
        this.dataService = ctx.dataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { assertionId, remotePeerId, handlerId } = command.data;

        const metadataNquads = await this.tripleStoreModuleManager
            .resolve(`${assertionId}#metadata`, true)
            .catch((e) =>
                this.handleError(handlerId, e.message, ERROR_TYPE.HANDLE_RESOLVE_REQUEST_ERROR),
            );
        const dataNquads = await this.tripleStoreModuleManager
            .resolve(`${assertionId}#data`, true)
            .catch((e) =>
                this.handleError(handlerId, e.message, ERROR_TYPE.HANDLE_RESOLVE_REQUEST_ERROR),
            );

        let messageType;
        let messageData;
        if (metadataNquads && metadataNquads.length && dataNquads && dataNquads.length) {
            const nquads = {
                metadataNquads,
                dataNquads,
            };
            nquads.metadataNquads = await this.dataService.toNQuads(
                nquads.metadataNquads,
                'application/n-quads',
            );
            nquads.dataNquads = await this.dataService.toNQuads(
                nquads.dataNquads,
                'application/n-quads',
            );
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
