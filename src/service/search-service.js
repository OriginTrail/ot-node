const {HANDLER_ID_STATUS} = require("../constants/constants");

class SearchService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.handlerIdService = ctx.handlerIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.commandExecutor = ctx.commandExecutor;
    }

    async processSearchResponse(command, responseData, status, errorMessage = null) {

        const { handlerId } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.SEARCH_ASSERTIONS.SEARCH_END,
        );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.SEARCH_ASSERTIONS.COMPLETED,
        );

        let data = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        data = [...new Set([...data ,...responseData])];

        await this.handlerIdService.cacheHandlerIdData(handlerId, data);
    }

}

module.exports = SearchService;
