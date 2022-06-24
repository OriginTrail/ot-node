const BaseController = require('./base-controller');
const {HANDLER_ID_STATUS, NETWORK_PROTOCOLS, ERROR_TYPE, NETWORK_MESSAGE_TYPES} = require('../../constants/constants');

class SearchController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.commandExecutor = ctx.commandExecutor;
        this.handlerIdService = ctx.handlerIdService;
    }

    async handleHttpApiSearchAssertionsRequest (req, res) {
        const { query } = req.query;

        const handlerId = await this.handlerIdService.generateHandlerId();

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.SEARCH_ASSERTIONS.SEARCH_START,
        );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.SEARCH_ASSERTIONS.VALIDATING_QUERY,
        );

        this.returnResponse(res, 202, {
            handlerId,
        });

        this.logger.info(`Search assertions for ${query} with handler id ${handlerId} initiated.`);

        try {

            // TODO: updated with query params from get req
            const options = {
                prefix: true,
                limit: 40,
            }

            const commandData = {
                handlerId,
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
            this.logger.error({
                msg: `Error while initializing search for assertions: ${error.message}. ${error.stack}`,
                Event_name: ERROR_TYPE.SEARCH_ASSERTIONS_ROUTE_ERROR,
                Event_value1: error.message,
            });
            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.FAILED,
                'Unable to search for assertions, Failed to process input data!',
            );
        }

    }

    async handleHttpApiSearchEntitiesRequest (req, res) {
        const { query } = req.query;

        const handlerId = await this.handlerIdService.generateHandlerId();

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.SEARCH_ENTITIES.VALIDATING_QUERY,
        );

        this.returnResponse(res, 202, {
            handlerId,
        });

        this.logger.info(`Search entities for ${query} with handler id ${handlerId} initiated.`);

        try {

            // TODO: updated with query params
            const options = {
                prefix: true,
                limit: 40,
            }

            const commandData = {
                handlerId,
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
            this.logger.error({
                msg: `Error while initializing search for entities: ${error.message}. ${error.stack}`,
                Event_name: ERROR_TYPE.SEARCH_ENTITIES_ROUTE_ERROR,
                Event_value1: error.message,
            });
            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.FAILED,
                'Unable to search for entities, Failed to process input data!',
            );
        }
    }

    handleHttpApiQueryRequest (req, res) {

    }

    handleHttpApiProofsRequest (req, res) {

    }

    async handleNetworkSearchAssertionsRequest(message, remotePeerId) {
        let commandName;
        const { handlerId } = message.header;
        const commandData = { message, remotePeerId, handlerId };
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
        const { handlerId } = message.header;
        const commandData = { message, remotePeerId, handlerId };
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

module.exports = SearchController;
