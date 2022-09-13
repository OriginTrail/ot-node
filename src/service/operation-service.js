import {
    OPERATION_ID_STATUS,
    OPERATION_REQUEST_STATUS,
    OPERATION_STATUS,
} from '../constants/constants.js';

class OperationService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.commandExecutor = ctx.commandExecutor;
    }

    getOperationName() {
        return this.operationName;
    }

    getNetworkProtocol() {
        return this.networkProtocol;
    }

    getMinimumAckResponses() {
        return this.config.minimumAckResponses[this.operationName];
    }

    async getOperationStatus(operationId) {
        return this.repositoryModuleManager.getOperationStatus(this.operationName, operationId);
    }

    async shouldMarkAsCompleted(operationId, completedResponses) {
        return (
            completedResponses === this.getMinimumAckResponses() &&
            (await this.getOperationStatus(operationId)).status === OPERATION_STATUS.IN_PROGRESS
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

    async markOperationAsCompleted(operationId, responseData, endStatuses) {
        this.logger.info(`Finalizing ${this.networkProtocol} for operationId: ${operationId}`);

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            operationId,
            OPERATION_STATUS.COMPLETED,
        );

        await this.operationIdService.cacheOperationIdData(operationId, responseData);

        for (const status of endStatuses) {
            // eslint-disable-next-line no-await-in-loop
            await this.operationIdService.updateOperationIdStatus(operationId, status);
        }
    }

    async markOperationAsFailed(operationId, message) {
        this.logger.info(`${this.networkProtocol} for operationId: ${operationId} failed.`);

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            operationId,
            this.operationStatus.FAILED,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FAILED,
            message,
            this.errorType,
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
