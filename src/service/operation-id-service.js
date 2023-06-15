import { validate, v4 as uuidv4 } from 'uuid';
import path from 'path';

class OperationIdService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
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
        status,
        value1 = null,
        value2 = null,
        timestamp = Date.now(),
    ) {
        const response = {
            status,
            timestamp,
        };

        this.emitChangeEvent(status, operationId, value1, value2, null, timestamp);

        await this.repositoryModuleManager.updateOperationIdRecord(response, operationId);
    }

    async updateOperationIdStatus(operationId, status, errorMessage = null, errorType = null) {
        const response = {
            status,
        };

        if (errorMessage !== null) {
            this.logger.debug(`Marking operation id ${operationId} as failed`);
            response.data = JSON.stringify({ errorMessage, errorType });
            await this.removeOperationIdCache(operationId);
        }

        this.emitChangeEvent(status, operationId, errorMessage, errorType);

        await this.repositoryModuleManager.updateOperationIdRecord(response, operationId);
    }

    emitChangeEvent(
        status,
        operationId,
        value1 = null,
        value2 = null,
        value3 = null,
        timestamp = Date.now(),
    ) {
        const eventName = 'operation_status_changed';

        const eventData = {
            lastEvent: status,
            operationId,
            timestamp,
            value1,
            value2,
            value3,
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

        this.memoryCachedHandlersData[operationId] = { data, timestamp: Date.now() };
    }

    async getCachedOperationIdData(operationId) {
        if (this.memoryCachedHandlersData[operationId]) {
            this.logger.debug(`Reading operation id: ${operationId} cached data from memory`);
            return this.memoryCachedHandlersData[operationId].data;
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

    async removeExpiredOperationIdMemoryCache(expiredTimeout) {
        const now = Date.now();
        let deleted = 0;
        for (const operationId in this.memoryCachedHandlersData) {
            const { data, timestamp } = this.memoryCachedHandlersData[operationId];
            if (timestamp + expiredTimeout < now) {
                delete this.memoryCachedHandlersData[operationId];
                deleted += Buffer.from(JSON.stringify(data)).byteLength;
            }
        }
        return deleted;
    }

    async removeExpiredOperationIdFileCache(expiredTimeout) {
        const cacheFolderPath = this.fileService.getOperationIdCachePath();
        const cacheFolderExists = await this.fileService.fileExists(cacheFolderPath);
        if (!cacheFolderExists) {
            return;
        }
        const fileList = await this.fileService.readDirectory(cacheFolderPath);
        const deleteFile = async (fileName) => {
            const filePath = path.join(cacheFolderPath, fileName);
            const now = new Date();
            const createdDate = (await this.fileService.stat(filePath)).mtime;
            if (createdDate.getTime() + expiredTimeout < now.getTime()) {
                await this.fileService.removeFile(filePath);
                return true;
            }
            return false;
        };
        const deleted = await Promise.all(fileList.map((fileName) => deleteFile(fileName)));
        return deleted.filter((x) => x).length;
    }
}

export default OperationIdService;
