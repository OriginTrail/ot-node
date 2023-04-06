class OperationIdServiceMock {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async cacheOperationIdData(operationId, data) {
        console.log(operationId, data);

        return {};
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
