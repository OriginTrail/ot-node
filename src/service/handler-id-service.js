const validator = require('validator');
const { HANDLER_ID_STATUS } = require('../constants/constants');

class HandlerIdService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.eventEmitter = ctx.eventEmitter;

        this.memoryCachedHandlersData = {};
    }

    async generateHandlerId() {
        const handlerIdObject = await this.repositoryModuleManager.createHandlerIdRecord({
            status: HANDLER_ID_STATUS.PENDING,
        });
        this.logger.debug(`Generated handler id for request ${handlerIdObject.handler_id}`);
        return handlerIdObject.handler_id;
    }

    async getHandlerIdRecord(handlerId) {
        const handlerIdRecord = await this.repositoryModuleManager.getHandlerIdRecord(handlerId);
        return handlerIdRecord;
    }

    handlerIdInRightFormat(handlerId) {
        return validator.isUUID(handlerId);
    }

    async updateHandlerIdStatus(handlerId, status, errorMessage = null) {
        const respond = {
            status
        }
        const timestamp = Date.now();
        const eventName = 'operation_status_changed';
        const eventData = {
            lastEvent: status,
            handlerId,
            timestamp
        }

        if(errorMessage !== null) {
            this.logger.debug(`Marking handler id ${handlerId} as failed`);
            respond.data = JSON.stringify({ errorMessage });
            await this.removeHandlerIdCache(handlerId);
            eventData.errorMessage = errorMessage;
        }

        this.eventEmitter.emit(eventName, eventData);

        await this.repositoryModuleManager.updateHandlerIdRecord(
            respond,
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
        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId);
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
