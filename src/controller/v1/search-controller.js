import BaseController from './base-controller.js';

import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    NETWORK_MESSAGE_TYPES,
} from '../../constants/constants.js';

class SearchController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.queryService = ctx.queryService;
    }

    async handleHttpApiSearchAssertionsRequest(req, res) {
        const { query } = req.query;

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.SEARCH_ASSERTIONS.SEARCH_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.SEARCH_ASSERTIONS.VALIDATING_QUERY,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        this.logger.info(
            `Search assertions for ${query} with operation id ${operationId} initiated.`,
        );

        try {
            // TODO: updated with query params from get req
            const options = {
                prefix: true,
                limit: 40,
            };

            const commandData = {
                operationId,
                query,
                options,
                networkProtocol: NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
            };

            const commandSequence = [
                'localSearchAssertionsCommand',
                'findNodesCommand',
                'searchAssertionsCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        } catch (error) {
            this.logger.error(
                `Error while initializing search for assertions: ${error.message}. ${error.stack}`,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.FAILED,
                'Unable to search for assertions, Failed to process input data!',
            );
        }
    }

    async handleHttpApiSearchEntitiesRequest(req, res) {
        const { query } = req.query;

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.SEARCH_ENTITIES.VALIDATING_QUERY,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        this.logger.info(
            `Search entities for ${query} with operation id ${operationId} initiated.`,
        );

        try {
            // TODO: updated with query params
            const options = {
                prefix: true,
                limit: 40,
            };

            const commandData = {
                operationId,
                query,
                options,
                networkProtocol: NETWORK_PROTOCOLS.SEARCH,
            };

            const commandSequence = [
                'localSearchEntitiesCommand',
                'findNodesCommand',
                'searchEntitiesCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        } catch (error) {
            this.logger.error(
                `Error while initializing search for entities: ${error.message}. ${error.stack}`,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.FAILED,
                'Unable to search for entities, Failed to process input data!',
            );
        }
    }

    async handleHttpApiQueryRequest(req, res) {
        const { query, type: queryType } = req.body;

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.QUERY.QUERY_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.QUERY.QUERY_INIT_END,
        );

        const commandSequence = ['queryCommand'];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: { query, queryType, operationId },
            transactional: false,
        });
    }

    handleHttpApiProofsRequest() {}

    async handleNetworkSearchAssertionsRequest(message, remotePeerId) {
        let commandName;
        const { operationId } = message.header;
        const commandData = { message, remotePeerId, operationId };
        switch (message.header.messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandName = 'handleSearchAssertionsInitCommand';
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandName = 'handleSearchAssertionsRequestCommand';
                break;
            default:
                throw Error('unknown messageType');
        }

        await this.commandExecutor.add({
            name: commandName,
            sequence: [],
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }

    async handleNetworkSearchEntitiesRequest(message, remotePeerId) {
        let commandName;
        const { operationId } = message.header;
        const commandData = { message, remotePeerId, operationId };
        switch (message.header.messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandName = 'handleSearchEntitiesInitCommand';
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandName = 'handleSearchEntitiesRequestCommand';
                break;
            default:
                throw Error('unknown messageType');
        }

        await this.commandExecutor.add({
            name: commandName,
            sequence: [],
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }
}

export default SearchController;
