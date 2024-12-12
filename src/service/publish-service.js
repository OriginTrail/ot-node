import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';

import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
} from '../constants/constants.js';

class PublishService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.operationName = OPERATIONS.PUBLISH;
        this.networkProtocols = NETWORK_PROTOCOLS.STORE;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_END,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
        this.operationMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const {
            operationId,
            blockchain,
            numberOfShardNodes,
            leftoverNodes,
            batchSize,
            minAckResponses,
            datasetRoot,
        } = command.data;

        const datasetRootStatus = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            operationId,
        );

        const { completedNumber, failedNumber } = datasetRootStatus[operationId];

        const totalResponses = completedNumber + failedNumber;

        this.logger.debug(
            `Processing ${
                this.operationName
            } response with status: ${responseStatus} for operationId: ${operationId}, dataset root: ${datasetRoot}. Total number of nodes: ${numberOfShardNodes}, number of nodes in batch: ${Math.min(
                numberOfShardNodes,
                batchSize,
            )} number of leftover nodes: ${
                leftoverNodes.length
            }, number of responses: ${totalResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}, minimum replication factor: ${minAckResponses}`,
        );
        if (responseData.errorMessage) {
            this.logger.trace(
                `Error message for operation id: ${operationId}, dataset root: ${datasetRoot} : ${responseData.errorMessage}`,
            );
        }

        // Minimum replication reached, mark in the operational DB
        if (completedNumber === minAckResponses) {
            this.logger.debug(
                `Minimum replication ${minAckResponses} reached for operationId: ${operationId}, dataset root: ${datasetRoot}`,
            );

            await this.repositoryModuleManager.updateMinAcksReached(operationId, true);
        }

        // All requests sent, minimum replication reached, mark as completed
        if (leftoverNodes.length === 0 && completedNumber >= minAckResponses) {
            await this.markOperationAsCompleted(
                operationId,
                blockchain,
                null,
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        }

        // All requests sent, minimum replication not reached, mark as failed
        if (leftoverNodes.length === 0 && completedNumber < minAckResponses) {
            this.markOperationAsFailed(
                operationId,
                blockchain,
                'Not replicated to enough nodes!',
                this.errorType,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        }

        // Not all requests sent, still possible to reach minimum replication,
        // schedule requests for leftover nodes
        const potentialCompletedNumber = completedNumber + leftoverNodes.length;
        if (leftoverNodes.length > 0 && potentialCompletedNumber >= minAckResponses) {
            await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
        }
    }

    async getBatchSize() {
        return 20;
    }

    async getMinAckResponses(minimumNumberOfNodeReplications = null) {
        return minimumNumberOfNodeReplications ?? 10;
    }
}

export default PublishService;
