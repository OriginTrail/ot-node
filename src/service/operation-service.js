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

    async getResponsesStatuses(responseStatus, errorMessage, operationId) {
        let responses = 0;
        const self = this;
        await this.operationMutex.runExclusive(async () => {
            await self.repositoryModuleManager.createOperationResponseRecord(
                responseStatus,
                this.operationName,
                operationId,
                errorMessage,
            );
            responses = await self.repositoryModuleManager.getOperationResponsesStatuses(
                this.operationName,
                operationId,
            );
        });

        const operationIdStatuses = {};
        for (const response of responses) {
            if (!operationIdStatuses[operationId])
                operationIdStatuses[operationId] = { failedNumber: 0, completedNumber: 0 };

            if (response.status === OPERATION_REQUEST_STATUS.FAILED) {
                operationIdStatuses[operationId].failedNumber += 1;
            } else {
                operationIdStatuses[operationId].completedNumber += 1;
            }
        }

        return operationIdStatuses;
    }

    async markOperationAsCompleted(operationId, blockchain, responseData, endStatuses) {
        this.logger.info(`Finalizing ${this.operationName} for operationId: ${operationId}`);

        if (responseData === null) {
            await this.operationIdService.removeOperationIdCache(operationId);
        } else {
            await this.operationIdService.cacheOperationIdDataToMemory(operationId, responseData);
            await this.operationIdService.cacheOperationIdDataToFile(operationId, responseData);
        }

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            operationId,
            OPERATION_STATUS.COMPLETED,
        );

        for (const status of endStatuses) {
            // eslint-disable-next-line no-await-in-loop
            await this.operationIdService.updateOperationIdStatus(operationId, blockchain, status);
        }
    }

    async markOperationAsFailed(operationId, blockchain, message, errorType) {
        this.logger.info(`${this.operationName} for operationId: ${operationId} failed.`);

        await this.operationIdService.removeOperationIdCache(operationId);

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

    getBatchSize() {
        throw Error('getBatchSize not implemented');
    }

    getMinAckResponses() {
        throw Error('getMinAckResponses not implemented');
    }
}

export default OperationService;
