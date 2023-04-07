class OperationIdServiceMock {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    /* eslint-disable-next-line no-unused-vars */
    async cacheOperationIdData(operationId, data) {
        console.log('aa');
        return {};
    }

    /* eslint-disable-next-line no-unused-vars */
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
