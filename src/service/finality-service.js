import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';
import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
} from '../constants/constants.js';

class FinalityService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = OPERATIONS.FINALITY;
        this.networkProtocols = NETWORK_PROTOCOLS.FINALITY;
        this.errorType = ERROR_TYPE.FINALITY.FINALITY_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.FINALITY.FINALITY_FETCH_FROM_NODES_END,
            OPERATION_ID_STATUS.FINALITY.FINALITY_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
        this.ualService = ctx.ualService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.paranetService = ctx.paranetService;
        this.operationMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData) {
        const { operationId, blockchain, numberOfFoundNodes, leftoverNodes, batchSize } =
            command.data;

        const responseStatusesFromDB = await this.getResponsesStatuses(
            responseStatus,
            responseData.errorMessage,
            operationId,
        );

        const { completedNumber, failedNumber } = responseStatusesFromDB[operationId];

        const totalResponses = completedNumber + failedNumber;
        const isAllNodesResponded = numberOfFoundNodes === totalResponses;
        const isBatchCompleted = totalResponses % batchSize === 0;

        const minimumNumberOfNodeReplications =
            command.data.minimumNumberOfNodeReplications ?? numberOfFoundNodes;

        this.logger.debug(
            `Processing ${
                this.operationName
            } response with status: ${responseStatus} for operationId: ${operationId}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${Math.min(
                numberOfFoundNodes,
                batchSize,
            )} number of leftover nodes: ${
                leftoverNodes.length
            }, number of responses: ${totalResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}`,
        );
        if (responseData.errorMessage) {
            this.logger.trace(
                `Error message for operation id: ${operationId} : ${responseData.errorMessage}`,
            );
        }

        if (
            responseStatus === OPERATION_REQUEST_STATUS.COMPLETED &&
            completedNumber === minimumNumberOfNodeReplications
        ) {
            await this.markOperationAsCompleted(
                operationId,
                blockchain,
                {
                    completedNodes: completedNumber,
                    allNodesReplicatedData: true,
                },
                [...this.completedStatuses],
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        } else if (
            completedNumber < minimumNumberOfNodeReplications &&
            (isAllNodesResponded || isBatchCompleted)
        ) {
            const potentialCompletedNumber = completedNumber + leftoverNodes.length;

            await this.operationIdService.cacheOperationIdDataToFile(operationId, {
                completedNodes: completedNumber,
                allNodesReplicatedData: false,
            });

            // Still possible to meet minimumNumberOfNodeReplications, schedule leftover nodes
            if (
                leftoverNodes.length > 0 &&
                potentialCompletedNumber >= minimumNumberOfNodeReplications
            ) {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            } else {
                // Not enough potential responses to meet minimumNumberOfNodeReplications, or no leftover nodes
                await this.markOperationAsFailed(
                    operationId,
                    blockchain,
                    `Unable to replicate data on the network!`,
                    this.errorType,
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            }
        }
    }

    async getBatchSize() {
        return 20;
    }

    // this is not used, because instead of predefined minAckResponses, we use minimumNumberOfNodeReplications from the client
    async getMinAckResponses() {
        return 1;
    }
}

export default FinalityService;