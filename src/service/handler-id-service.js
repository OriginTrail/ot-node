const {HANDLER_ID_STATUS} = require("../../modules/constants");

class HandlerIdService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.memoryCachedHandlersData = {};
    }

    async generateHandlerId() {
        const handlerIdObject = await this.repositoryModuleManager.createHandlerIdRecord({
            status: HANDLER_ID_STATUS.PENDING,
        });
        this.logger.debug(`Generated handler id for request ${handlerIdObject.handler_id}`);
        return handlerIdObject.handler_id;
    }

    async updateFailedHandlerId(handlerId, errorMessage) {
        this.logger.debug(`Marking handler id ${handlerId} as failed`);
        await this.removeHandlerIdCache(handlerId);

        await this.repositoryModuleManager.updateHandlerIdRecord(
            {
                status: HANDLER_ID_STATUS.FAILED,
                data: JSON.stringify({errorMessage}),
            },
            handlerId,
        );
    }

    async updateHandlerIdStatus(handlerId, status) {
        await this.repositoryModuleManager.updateHandlerIdRecord(
            {
                status,
            },
            handlerId,
        );
    }

    async cacheHandlerIdData(handlerId, data) {
        this.logger.debug(`Caching data for handler id: ${handlerId} in file`);
        const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

        await this.fileService.writeContentsToFile(
            handlerIdCachePath,
            handlerId,
            JSON.stringify(data),
        );

        this.memoryCachedHandlersData[handlerId] = data;
    }

    async getCachedHandlerIdData(handlerId) {
        if (this.memoryCachedHandlersData[handlerId]) {
            this.logger.debug(`Reading handler id: ${handlerId} cached data from memory`);
            return this.memoryCachedHandlersData[handlerId];
        }

        this.logger.debug(`Reading handler id: ${handlerId} cached data from file`);
        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId)
        const data = await this.fileService.readFileOnPath(documentPath);
        return JSON.parse(data);
    }

    async removeHandlerIdCache(handlerId) {
        this.logger.debug(`Removing handler id: ${handlerId} cached data`);
        const handlerIdCachePath = this.fileService.getHandlerIdDocumentPath(handlerId);
        await this.fileService.removeFile(handlerIdCachePath);
        this.removeHandlerIdMemoryCache(handlerId);
    }

    removeHandlerIdMemoryCache(handlerId) {
        this.logger.debug(`Removing handler id: ${handlerId} cached data from memory`);
        delete this.memoryCachedHandlersData[handlerId];
    }
}

module.exports = HandlerIdService;
