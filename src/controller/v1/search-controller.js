const BaseController = require('./base-controller');
const {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
} = require('../../constants/constants');

class SearchController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationService = ctx.searchService;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async handleHttpApiSearchRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.SEARCH.SEARCH_START,
        );
        const { keywords, limit, offset } = req.body;

        this.returnResponse(res, 202, {
            operationId,
        });

        this.logger.info(
            `Search for ${keywords} with ${limit}, ${offset},operation id ${operationId} initiated.`,
        );

        try {
            await this.repositoryModuleManager.createOperationRecord(
                this.operationService.getOperationName(),
                operationId,
                this.operationService.getOperationStatus().IN_PROGRESS,
            );

            await this.commandExecutor.add({
                name: 'networkSearchCommand',
                sequence: [],
                delay: 0,
                data: {
                    operationId,
                    keywords,
                    limit,
                    offset,
                },
                transactional: false,
            });
        } catch (error) {
            this.logger.error(`Error while initializing search: ${error.message}. ${error.stack}`);
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.FAILED,
                'Unable to search, Failed to process input data!',
                ERROR_TYPE.SEARCH.SEARCH_ROUTE_ERROR,
            );
        }
    }

    async handleNetworkSearchRequest(message, remotePeerId) {
        const { operationId, keywordUuid, messageType } = message.header;
        const { keyword, limit, offset } = message.data;
        const command = {
            sequence: [],
            delay: 0,
            data: { remotePeerId, operationId, keywordUuid, keyword, limit, offset },
            transactional: false,
        };
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                command.name = 'handleSearchInitCommand';
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                command.name = 'handleSearchRequestCommand';
                break;
            default:
                throw Error(`Unknown publish type ${publishType}`);
        }

        await this.commandExecutor.add(command);
    }
}

module.exports = SearchController;
