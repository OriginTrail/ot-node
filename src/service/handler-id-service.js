const {HANDLER_ID_STATUS} = require("../../modules/constants");

class HandlerIdService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async generateHandlerId() {
        const handlerId = await this.repositoryModuleManager.createHandlerIdRecord({
            status: HANDLER_ID_STATUS.PENDING,
        });
        return handlerId;
    }

    async updateFailedHandlerId(handlerId, errorMessage) {
        if (handlerId !== null) {
            const handlerIdCachePath = this.fileService.getHandlerIdDocumentPath(handlerId);

            await this.fileService.removeFile(handlerIdCachePath);
            await this.repositoryModuleManager.updateHandlerIdRecord(
                {
                    status: HANDLER_ID_STATUS.FAILED,
                    data: JSON.stringify({ errorMessage }),
                },
                handlerId,
            );
        }
    }

    async cacheHandlerIdData(handlerId, data) {
        const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

        await this.fileService.writeContentsToFile(
            handlerIdCachePath,
            handlerId,
            data,
        );
    }

    async getCachedHandlerIdData(handlerId) {
        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId)
        const data = await this.fileService.readFileOnPath(documentPath);
        return data;
    }
}

module.exports = HandlerIdService;
