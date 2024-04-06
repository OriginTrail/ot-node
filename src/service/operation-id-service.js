import { validate, v4 as uuidv4 } from 'uuid';

class OperationIdService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.keyValueStoreModuleManager = ctx.keyValueStoreModuleManager;
        this.eventEmitter = ctx.eventEmitter;

        this.memoryCachedHandlersData = {};
    }

    generateId() {
        return uuidv4();
    }

    async generateOperationId(status) {
        const operationIdObject = await this.repositoryModuleManager.createOperationIdRecord({
            status,
        });
        const { operationId } = operationIdObject;
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
        return validate(operationId);
    }

    async updateOperationIdStatusWithValues(
        operationId,
        blockchain,
        status,
        value1 = null,
        value2 = null,
        value3 = null,
        timestamp = Date.now(),
    ) {
        const response = {
            status,
            timestamp,
        };

        this.emitChangeEvent(status, operationId, blockchain, value1, value2, value3, timestamp);

        await this.repositoryModuleManager.updateOperationIdRecord(response, operationId);
    }

    async updateOperationIdStatus(
        operationId,
        blockchain,
        status,
        errorMessage = null,
        errorType = null,
    ) {
        const response = {
            status,
        };

        if (errorMessage !== null) {
            this.logger.debug(`Marking operation id ${operationId} as failed`);
            response.data = JSON.stringify({ errorMessage, errorType });
            await this.removeCachedOperationIdData(operationId);
        }

        this.emitChangeEvent(status, operationId, blockchain, errorMessage, errorType);

        await this.repositoryModuleManager.updateOperationIdRecord(response, operationId);
    }

    emitChangeEvent(
        status,
        operationId,
        blockchainId = null,
        value1 = null,
        value2 = null,
        value3 = null,
        timestamp = Date.now(),
    ) {
        const eventName = 'operation_status_changed';

        const eventData = {
            lastEvent: status,
            operationId,
            blockchainId,
            timestamp,
            value1,
            value2,
            value3,
        };

        this.eventEmitter.emit(eventName, eventData);
    }

    async cacheOperationIdData(operationId, data) {
        this.logger.debug(`Caching data for operation id: ${operationId} in key value store`);

        await this.keyValueStoreModuleManager.cacheOperationIdData(operationId, data);
    }

    async getCachedOperationIdData(operationId) {
        this.logger.debug(`Reading operation id: ${operationId} cached data from key value store`);

        return this.keyValueStoreModuleManager.getCachedOperationIdData(operationId);
    }

    async removeCachedOperationIdData(operationId) {
        this.logger.debug(`Removing operation id: ${operationId} cached data from key value store`);

        return this.keyValueStoreModuleManager.removeCachedOperationIdData(operationId);
    }

    async removeExpiredOperationIdFileCache(expiredTimeout) {
        const operationIdsDataIterable =
            await this.keyValueStoreModuleManager.getAllCachedOperationIdsDataIterable();

        let totalDeleted = 0;
        const now = Date.now();
        for (const { key, value } of operationIdsDataIterable) {
            if (value.timestamp + expiredTimeout < now) {
                // eslint-disable-next-line no-await-in-loop
                const removed = await this.removeCachedOperationIdData(key);
                if (removed) totalDeleted += 1;
            }
        }

        return totalDeleted;
    }
}

export default OperationIdService;
