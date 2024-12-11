import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';

import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
} from '../constants/constants.js';

class PublishService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.signatureService = ctx.signatureService;
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
        const isAllNodesResponded = numberOfShardNodes === totalResponses;
        const isBatchCompleted = totalResponses % batchSize === 0;

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

        if (
            responseStatus === OPERATION_REQUEST_STATUS.COMPLETED &&
            completedNumber === minAckResponses
        ) {
            const signatures = await this.signatureService.getSignaturesFromStorage(operationId);
            await this.markOperationAsCompleted(
                operationId,
                blockchain,
                signatures,
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        } else if (completedNumber < minAckResponses && (isAllNodesResponded || isBatchCompleted)) {
            const potentialCompletedNumber = completedNumber + leftoverNodes.length;

            // Still possible to meet minAckResponses, schedule leftover nodes
            if (leftoverNodes.length > 0 && potentialCompletedNumber >= minAckResponses) {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            } else {
                // Not enough potential responses to meet minAckResponses, or no leftover nodes
                this.markOperationAsFailed(
                    operationId,
                    blockchain,
                    'Not replicated to enough nodes!',
                    this.errorType,
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            }
        }
    }

    async getBatchSize(blockchainId) {
        return this.blockchainModuleManager.getR2(blockchainId);
    }

    async getMinAckResponses(blockchainId, minimumNumberOfNodeReplications = null) {
        return minimumNumberOfNodeReplications ?? this.blockchainModuleManager.getR1(blockchainId);
    }
}

export default PublishService;
