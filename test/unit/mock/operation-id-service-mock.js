class OperationIdServiceMock {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    cacheOperationIdData(operationId, data) {}

    async updateOperationIdStatus(operationId, status, errorMessage = null, errorType = null) {
        if (errorMessage) console.log(errorMessage);

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
