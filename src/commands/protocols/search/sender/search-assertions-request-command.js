import ProtocolRequestCommand from '../../common/protocol-request-command.js';
import {
    ERROR_TYPE,
    NETWORK_PROTOCOLS,
    OPERATION_ID_STATUS,
} from '../../../../constants/constants.js';
import Command from '../../../command.js';

class searchAssertionsRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.operationIdService = ctx.operationIdService;
        this.searchService = ctx.searchService;

        this.commandName = 'searchAssertionsRequestCommand';
        this.errorType = ERROR_TYPE.SEARCH_ASSERTIONS_REQUEST_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.SEARCH_ASSERTIONS;
    }

    async prepareMessage(command) {
        const { operationId, query, options } = command.data;

        return {
            options,
            operationId,
            query,
        };
    }

    async handleAck(command, responseData) {
        await this.searchService.processSearchResponse(
            command,
            responseData,
            OPERATION_ID_STATUS.SEARCH_ASSERTIONS.COMPLETED,
        );
        return Command.empty();
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.searchService.processSearchResponse(
            command,
            OPERATION_ID_STATUS.SEARCH_ASSERTIONS.FAILED,
            errorMessage,
        );
    }

    handleError(operationId, error, msg) {
        this.logger.error(msg);
    }

    /**
     * Builds default searchAssertionsRequest
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'searchAssertionsRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.SEARCH_ASSERTIONS_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

export default searchAssertionsRequestCommand;
