const validator = require('validator');

class OperationIdService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.eventEmitter = ctx.eventEmitter;

        this.memoryCachedHandlersData = {};
    }

    async generateOperationId(status) {
        const operationIdObject = await this.repositoryModuleManager.createOperationIdRecord({
            status,
        });
        const operationId = operationIdObject.operation_id;
        this.emitChangeEvent(status, operationId);
        this.logger.debug(`Generated operation id for request ${operationId}`);
        return operationId;
    }

    async getOperationIdRecord(operationId) {
        const operationIdRecord = await this.repositoryModuleManager.getOperationIdRecord(
            operationId,
        );
        return operationIdRecord;
    }

    operationIdInRightFormat(operationId) {
        return validator.isUUID(operationId);
    }

    async updateOperationIdStatus(operationId, status, errorMessage = null, errorType = null) {
        const response = {
            status,
        };

        if (errorMessage !== null) {
            this.logger.debug(`Marking operation id ${operationId} as failed`);
            response.data = JSON.stringify({ errorMessage, errorType: status });
            await this.removeOperationIdCache(operationId);
        }

        this.emitChangeEvent(status, operationId, errorMessage, errorType);

        await this.repositoryModuleManager.updateOperationIdRecord(response, operationId);
    }

    async updateOperationIdData(data, operationId) {
        await this.repositoryModuleManager.updateOperationIdRecord(data, operationId);
    }

    emitChangeEvent(status, operationId, errorMessage = null, errorType = null) {
        const timestamp = Date.now();
        const eventName = 'operation_status_changed';

        const eventData = {
            lastEvent: status,
            operationId,
            timestamp,
            value1: errorMessage,
            value2: errorType,
        };

        this.eventEmitter.emit(eventName, eventData);
    }

    async cacheOperationIdData(operationId, data) {
        this.logger.debug(`Caching data for operation id: ${operationId} in file`);
        const operationIdCachePath = this.fileService.getOperationIdCachePath();

        await this.fileService.writeContentsToFile(
            operationIdCachePath,
            operationId,
            JSON.stringify(data),
        );

        this.memoryCachedHandlersData[operationId] = data;
    }

    async getCachedOperationIdData(operationId) {
        if (this.memoryCachedHandlersData[operationId]) {
            this.logger.debug(`Reading operation id: ${operationId} cached data from memory`);
            return this.memoryCachedHandlersData[operationId];
        }

        this.logger.debug(`Reading operation id: ${operationId} cached data from file`);
        const documentPath = this.fileService.getOperationIdDocumentPath(operationId);
        let data;
        if (await this.fileService.fileExists(documentPath)) {
            data = await this.fileService.loadJsonFromFile(documentPath);
        }
        return data;
    }

    async removeOperationIdCache(operationId) {
        this.logger.debug(`Removing operation id: ${operationId} cached data`);
        const operationIdCachePath = this.fileService.getOperationIdDocumentPath(operationId);
        await this.fileService.removeFile(operationIdCachePath);
        this.removeOperationIdMemoryCache(operationId);
    }

    removeOperationIdMemoryCache(operationId) {
        this.logger.debug(`Removing operation id: ${operationId} cached data from memory`);
        delete this.memoryCachedHandlersData[operationId];
    }
}

module.exports = OperationIdService;
