const { OPERATION_ID_STATUS } = require('../constants/constants');

class SearchService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.commandExecutor = ctx.commandExecutor;
    }

    async processSearchResponse(command, responseData) {
        const { operationId } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.SEARCH_ASSERTIONS.SEARCH_END,
        );
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.SEARCH_ASSERTIONS.COMPLETED,
        );

        let data = await this.operationIdService.getCachedOperationIdData(operationId);

        data = [...new Set([...data, ...responseData])];

        await this.operationIdService.cacheOperationIdData(operationId, data);
    }
}

module.exports = SearchService;
