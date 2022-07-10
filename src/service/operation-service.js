const { Mutex } = require('async-mutex');
const { HANDLER_ID_STATUS } = require('../constants/constants');

const mutex = new Mutex();

class OperationService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.handlerIdService = ctx.handlerIdService;
        this.commandExecutor = ctx.commandExecutor;
    }

    getOperationName() {
        return this.operationName;
    }

    getNetworkProtocol() {
        return this.networkProtocol;
    }

    getOperationRequestStatus() {
        return this.operationRequestStatus;
    }

    getOperationStatus() {
        return this.operationStatus;
    }

    async getResponsesStatuses(responseStatus, errorMessage, handlerId, keyword) {
        const self = this;
        let responses = 0;
        await mutex.runExclusive(async () => {
            await self.repositoryModuleManager.createOperationResponseRecord(
                responseStatus,
                this.operationName,
                handlerId,
                keyword,
                errorMessage,
            );
            responses = await self.repositoryModuleManager.getOperationResponsesStatuses(
                this.operationName,
                handlerId,
            );
        });

        const keywordsStatuses = {};
        responses.forEach((response) => {
            if (!keywordsStatuses[response.keyword])
                keywordsStatuses[response.keyword] = { failedNumber: 0, completedNumber: 0 };

            if (response.status === this.operationRequestStatus.FAILED) {
                keywordsStatuses[response.keyword].failedNumber += 1;
            } else {
                keywordsStatuses[response.keyword].completedNumber += 1;
            }
        });

        return keywordsStatuses;
    }

    async markOperationAsCompleted(handlerId, responseData, endStatuses) {
        this.logger.info(`Finalizing ${this.networkProtocol} for handlerId: ${handlerId}`);

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            handlerId,
            this.operationStatus.COMPLETED,
        );

        await this.handlerIdService.cacheHandlerIdData(handlerId, responseData);

        for (const status of endStatuses) {
            await this.handlerIdService.updateHandlerIdStatus(handlerId, status);
        }
    }

    async markOperationAsFailed(handlerId, message) {
        this.logger.info(`${this.networkProtocol} for handlerId: ${handlerId} failed.`);

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            handlerId,
            this.operationStatus.FAILED,
        );

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.FAILED,
            message,
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

module.exports = OperationService;
