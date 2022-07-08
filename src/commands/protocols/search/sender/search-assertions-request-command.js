const ProtocolRequestCommand = require('../../common/protocol-request-command');
const {
    ERROR_TYPE,
    NETWORK_PROTOCOLS,
    HANDLER_ID_STATUS,
} = require('../../../../constants/constants');
const Command = require('../../../command');

class searchAssertionsRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.handlerIdService = ctx.handlerIdService;
        this.searchService = ctx.searchService;

        this.commandName = 'searchAssertionsRequestCommand';
        this.errorType = ERROR_TYPE.SEARCH_ASSERTIONS_REQUEST_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.SEARCH_ASSERTIONS;
    }

    async prepareMessage(command) {
        const { handlerId, query, options } = command.data;

        return {
            options,
            handlerId,
            query,
        };
    }

    async handleAck(command, responseData) {
        await this.searchService.processSearchResponse(
            command,
            responseData,
            HANDLER_ID_STATUS.SEARCH_ASSERTIONS.COMPLETED,
        );
        return Command.empty();
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.searchService.processSearchResponse(
            command,
            HANDLER_ID_STATUS.SEARCH_ASSERTIONS.FAILED,
            errorMessage,
        );
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.SEARCH_ASSERTIONS_REQUEST_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
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

module.exports = searchAssertionsRequestCommand;
