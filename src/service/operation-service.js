import {
    OPERATION_ID_STATUS,
    OPERATION_REQUEST_STATUS,
    OPERATION_STATUS,
} from '../constants/constants.js';

class OperationService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.commandExecutor = ctx.commandExecutor;
    }

    getOperationName() {
        return this.operationName;
    }

    getNetworkProtocols() {
        return this.networkProtocols;
    }

    async getOperationStatus(operationId) {
        return this.repositoryModuleManager.getOperationStatus(
            this.getOperationName(),
            operationId,
        );
    }

    async getResponsesStatuses(responseStatus, errorMessage, operationId, keyword) {
        const self = this;
        let responses = 0;
        await this.operationMutex.runExclusive(async () => {
            await self.repositoryModuleManager.createOperationResponseRecord(
                responseStatus,
                this.operationName,
                operationId,
                keyword,
                errorMessage,
            );
            responses = await self.repositoryModuleManager.getOperationResponsesStatuses(
                this.operationName,
                operationId,
            );
        });

        const keywordsStatuses = {};
        responses.forEach((response) => {
            if (!keywordsStatuses[response.keyword])
                keywordsStatuses[response.keyword] = { failedNumber: 0, completedNumber: 0 };

            if (response.status === OPERATION_REQUEST_STATUS.FAILED) {
                keywordsStatuses[response.keyword].failedNumber += 1;
            } else {
                keywordsStatuses[response.keyword].completedNumber += 1;
            }
        });

        return keywordsStatuses;
    }

    async markOperationAsCompleted(operationId, blockchain, responseData, endStatuses) {
        this.logger.info(`Finalizing ${this.operationName} for operationId: ${operationId}`);

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            operationId,
            OPERATION_STATUS.COMPLETED,
        );

        if (responseData != null) {
            await this.operationIdService.cacheOperationIdData(operationId, responseData);
        }

        for (const status of endStatuses) {
            // eslint-disable-next-line no-await-in-loop
            await this.operationIdService.updateOperationIdStatus(operationId, blockchain, status);
        }
    }

    async markOperationAsFailed(operationId, blockchain, message, errorType) {
        this.logger.info(`${this.operationName} for operationId: ${operationId} failed.`);

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            operationId,
            OPERATION_STATUS.FAILED,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FAILED,
            message,
            errorType,
        );
    }

    async scheduleOperationForLeftoverNodes(commandData, leftoverNodes) {
        await this.commandExecutor.add({
            name: `${this.operationName}ScheduleMessagesCommand`,
            delay: 0,
            data: { ...commandData, leftoverNodes },
            transactional: false,
        });
    }

    logResponsesSummary(completedNumber, failedNumber) {
        this.logger.info(
            `Total number of responses: ${
                failedNumber + completedNumber
            }, failed: ${failedNumber}, completed: ${completedNumber}`,
        );
    }
}

export default OperationService;
