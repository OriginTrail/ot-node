class OperationIdStorageDatabase {
    constructor(rootRepository) {
        this.repository = rootRepository.openDB(this.getName());
    }

    getName() {
        return 'operationIdStorage';
    }

    async cacheOperationIdData(operationId, data) {
        return this.repository.put(operationId, { timestamp: Date.now(), data });
    }

    async getCachedOperationIdData(operationId) {
        const { data } = await this.repository.get(operationId);
        return data
    }

    async removeCachedOperationIdData(operationId) {
        return this.repository.remove(operationId);
    }

    async getAllCachedOperationIdsDataIterable() {
        return this.repository.getRange();
    }
}

export default OperationIdStorageDatabase;
