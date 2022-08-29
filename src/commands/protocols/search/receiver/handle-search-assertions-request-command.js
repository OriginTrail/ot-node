/* eslint-disable import/extensions */
import Command from '../../../command.js';
import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS,
} from '../../../../constants/constants.js';

class HandleSearchAssertionsRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { message, remotePeerId, operationId } = command.data;

        const localQuery = true;
        const data = await this.tripleStoreModuleManager.findAssertionsByKeyword(
            message.data.query,
            message.data.options,
            localQuery,
        );

        const messageType = NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
        const messageData = data.map((assertion) => assertion.assertionId);
        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
            remotePeerId,
            messageType,
            operationId,
            messageData,
        );

        return Command.empty();
    }

    handleError(operationId, error, msg) {
        this.logger.error(msg);
    }

    /**
     * Builds default handleSearchAssertionsRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleSearchAssertionsRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_SEARCH_ASSERTIONS_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleSearchAssertionsRequestCommand;
