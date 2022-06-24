const ProtocolRequestCommand = require('../../common/protocol-request-command');
const {
    ERROR_TYPE,
    NETWORK_PROTOCOLS,
    HANDLER_ID_STATUS,
} = require('../../../constants/constants');
const Command = require("../../command");

class searchAssertionsRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.handlerIdService = ctx.handlerIdService;
        this.searchService = ctx.searchService;
        this.errorType = ERROR_TYPE.SEARCH_ASSERTIONS_REQUEST_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.SEARCH_ASSERTIONS;
    }

    async prepareMessage(command) {
        const {  handlerId, query, options } = command.data;

        return {
            options,
            handlerId,
            query,
        };
    }

    async handleAck(command, responseData) {
        await this.searchService.processSearchResponse(command, responseData, HANDLER_ID_STATUS.SEARCH_ASSERTIONS.COMPLETED);
        return Command.empty();
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.searchService.processSearchResponse(
            command,
            HANDLER_ID_STATUS.SEARCH_ASSERTIONS.FAILED,
            errorMessage,
        );
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    // async execute(command) {
    //     const { query, handlerId, nodes, sessionIds } = command.data;
    //
    //     const messages = sessionIds.map((sessionId) => ({
    //         header: {
    //             sessionId,
    //             messageType: NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST,
    //         },
    //         data: { query },
    //     }));
    //
    //     let failedResponses = 0;
    //     const sendMessagePromises = nodes.map(async (node, index) => {
    //         try {
    //             const response = await this.networkModuleManager.sendMessage(
    //                 NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
    //                 node,
    //                 messages[index],
    //             );
    //             if (
    //                 !response ||
    //                 response.header.messageType !== NETWORK_MESSAGE_TYPES.RESPONSES.ACK
    //             )
    //                 failedResponses += 1;
    //         } catch (e) {
    //             failedResponses += 1;
    //             this.handleError(
    //                 handlerId,
    //                 e,
    //                 `Error while sending search assertions request for query ${query} to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`,
    //             );
    //         }
    //     });
    //
    //     const assertionIds = await Promise.any(sendMessagePromises);
    //
    //     try {
    //         const cachedAssertionIds = await this.handlerIdService.getCachedHandlerIdData(handlerId);
    //
    //         // TODO: merge assertionsIds and cachedAssertionIds
    //
    //         await this.handlerIdService.cacheHandlerIdData(handlerId, nquads);
    //
    //         await this.handlerIdService.updateHandlerIdStatus(
    //             handlerId,
    //             HANDLER_ID_STATUS.COMPLETED,
    //         );
    //     } catch (e) {
    //         await this.handlerIdService.updateFailedHandlerId(handlerId, e.message);
    //     }
    //
    //     return this.continueSequence(command.data, command.sequence);
    // }

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
