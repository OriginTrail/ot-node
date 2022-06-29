const Command = require('../../command');
const {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
    HANDLER_ID_STATUS,
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

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_REMOTE_START,
        );

        // TODO: validate assertionId / ual

        const nquads = {
            metadata: [],
            data: [],
        };
        const resolvePromises = [
            this.tripleStoreModuleManager
                .resolve(`${assertionId}#metadata`, true)
                .then((resolved) => {
                    nquads.metadata = resolved;
                }),
            this.tripleStoreModuleManager.resolve(`${assertionId}#data`, true).then((resolved) => {
                nquads.data = resolved;
            }),
        ];

        await Promise.all(resolvePromises).catch((e) =>
            this.handleError(handlerId, e.message, ERROR_TYPE.HANDLE_RESOLVE_REQUEST_ERROR),
        );

        let messageType;
        if (nquads.metadata && nquads.metadata.length && nquads.data && nquads.data.length) {
            const normalizeNquadsPromises = [
                this.dataService
                    .toNQuads(nquads.metadata, 'application/n-quads')
                    .then((normalized) => {
                        nquads.metadata = normalized;
                    }),
                this.dataService.toNQuads(nquads.data, 'application/n-quads').then((normalized) => {
                    nquads.data = normalized;
                }),
            ];

            await Promise.all(normalizeNquadsPromises);
            this.logger.debug(`Number of metadata n-quads retrieved from the database is ${nquads.metadata.length}`);
            this.logger.debug(`Number of data n-quads retrieved from the database is ${nquads.data.length}`);
            messageType = NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        } else {
            messageType = NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
        }

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_REMOTE_END,
        );

        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.RESOLVE,
            remotePeerId,
            messageType,
            handlerId,
            { nquads },
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
