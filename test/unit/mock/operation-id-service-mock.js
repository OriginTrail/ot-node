class OperationIdServiceMock {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    cacheOperationIdData(operationId, data) {}

    async updateOperationIdStatus(
        operationId,
        blockchain,
        status,
        errorMessage = null,
        errorType = null,
    ) {
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
