class OperationIdServiceMock {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.cachedOperationId = null;
        this.cachedData = null;
    }

    cacheOperationIdData(operationId, data) {
        this.cachedOperationId = operationId;
        this.cachedData = data;
    }

    async updateOperationIdStatus(operationId, status, errorMessage = null, errorType = null) {
        if (errorMessage) console.log(errorMessage);
        if (errorType) console.log(errorType);

        await this.repositoryModuleManager.updateOperationIdRecord(
            {
                status,
                timestamp: new Date().toISOString(),
            },
            operationId,
        );
    }
}

export default OperationIdServiceMock;
