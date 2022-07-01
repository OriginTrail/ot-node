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

    async getResponsesStatuses(responseStatus, errorMessage, commandData) {
        const { handlerId, numberOfFoundNodes, numberOfNodesInBatch, leftoverNodes } = commandData;
        const self = this;
        let responses = 0;
        let failedNumber = 0;
        let completedNumber = 0;
        await mutex.runExclusive(async () => {
            await self.createRepositoryResponseRecord(responseStatus, handlerId, errorMessage);
            responses = await self.getRepositoryResponsesStatuses(handlerId);
        });

        responses.forEach((response) => {
            if (response.status === this.operationRequestStatus.FAILED) {
                failedNumber += 1;
            } else {
                completedNumber += 1;
            }
        });

        this.logger.debug(
            `Processing ${this.operationName} response. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${responses.length}`,
        );

        return { responses, failedNumber, completedNumber };
    }

    async createRepositoryResponseRecord(responseStatus, handlerId, errorMessage) {
        // overridden by subclasses
    }

    async getRepositoryResponsesStatuses(handlerId) {
        // overridden by subclasses
    }

    async updateRepositoryOperationStatus(handlerId, status) {
        // overridden by subclasses
    }

    async markOperationAsCompleted(handlerId, responseData, endStatuses) {
        this.logger.info(`Finalizing ${this.operationName} for handlerId: ${handlerId}`);

        await this.repositoryModuleManager.updatePublishStatus(
            handlerId,
            this.operationStatus.COMPLETED,
        );

        await this.handlerIdService.cacheHandlerIdData(handlerId, responseData);

        for (const status of endStatuses) {
            await this.handlerIdService.updateHandlerIdStatus(handlerId, status);
        }
    }

    async markOperationAsFailed(handlerId, message) {
        this.logger.info(`${this.operationName} for handlerId: ${handlerId} failed.`);
        await this.updateRepositoryOperationStatus(handlerId, this.operationStatus.FAILED);

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.FAILED,
            message,
        );
    }

    async scheduleOperationForLeftoverNodes(command, leftoverNodes, networkProtocolCommandName) {
        const commandData = command.data;
        commandData.nodes = leftoverNodes.slice(0, this.config.minimumReplicationFactor);
        if (this.config.minimumReplicationFactor < leftoverNodes.length) {
            commandData.leftoverNodes = leftoverNodes.slice(this.config.minimumReplicationFactor);
        } else {
            commandData.leftoverNodes = [];
        }
        this.logger.debug(
            `Trying to ${this.operationName} to next batch of ${commandData.nodes.length} nodes, leftover for retry: ${commandData.leftoverNodes.length}`,
        );
        await this.commandExecutor.add({
            name: networkProtocolCommandName,
            delay: 0,
            data: commandData,
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
