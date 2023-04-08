class OperationIdServiceMock {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async cacheOperationIdData(operationId, data) {
        console.log('Caching data for:', operationId);

        if (data.assertion) console.log('Caching data:', data.assertion);
        if (data.message) console.log('Message:', data.message);

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
