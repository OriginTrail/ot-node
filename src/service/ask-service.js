import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';
import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
} from '../constants/constants.js';

class AskService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = OPERATIONS.ASK;
        this.networkProtocols = NETWORK_PROTOCOLS.ASK;
        this.errorType = ERROR_TYPE.ASK.ASK_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.ASK.ASK_FETCH_FROM_NODES_END,
            OPERATION_ID_STATUS.ASK.ASK_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
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

        let cumulatedResponsesData;
        await this.operationMutex.runExclusive(async () => {
            cumulatedResponsesData = (await this.operationIdService.getCachedOperationIdData(
                operationId,
            )) ?? {
                responses: [],
                finalized: [],
                completedNodes: 0,
                allNodesReplicatedData: false,
            };

            if (responseData.knowledgeCollectionsExistArray)
                cumulatedResponsesData.responses.push(responseData.knowledgeCollectionsExistArray);

            const finalized = [];
            for (let i = 0; i < cumulatedResponsesData.responses.length; i += 1) {
                const nodeResponse = cumulatedResponsesData.responses[i];
                for (let j = 0; j < nodeResponse.length; j += 1) {
                    if (finalized[j] === undefined) finalized[j] = nodeResponse[j];
                    else finalized[j] = finalized[j] && nodeResponse[j];
                }
            }
            cumulatedResponsesData.finalized = finalized;

            cumulatedResponsesData.completedNodes = cumulatedResponsesData.responses.filter(
                (arr) => !arr.includes(false),
            ).length;

            cumulatedResponsesData.allNodesReplicatedData =
                cumulatedResponsesData.completedNodes >= minimumNumberOfNodeReplications;

            await this.operationIdService.cacheOperationIdDataToFile(
                operationId,
                cumulatedResponsesData,
            );
        });

        if (
            responseStatus === OPERATION_REQUEST_STATUS.COMPLETED &&
            cumulatedResponsesData.completedNodes === minimumNumberOfNodeReplications
        ) {
            await this.markOperationAsCompleted(operationId, blockchain, cumulatedResponsesData, [
                ...this.completedStatuses,
            ]);
            this.logResponsesSummary(completedNumber, failedNumber);
        } else if (
            cumulatedResponsesData.completedNodes < minimumNumberOfNodeReplications &&
            (isAllNodesResponded || isBatchCompleted)
        ) {
            const potentialCompletedNumber =
                cumulatedResponsesData.completedNodes + leftoverNodes.length;

            await this.operationIdService.cacheOperationIdDataToFile(
                operationId,
                cumulatedResponsesData,
            );

            // Still possible to meet minimumNumberOfNodeReplications, schedule leftover nodes
            if (
                leftoverNodes.length > 0 &&
                potentialCompletedNumber >= minimumNumberOfNodeReplications
            ) {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            } else {
                // Not enough potential responses to meet minimumNumberOfNodeReplications, or no leftover nodes
                await this.markOperationAsCompleted(
                    operationId,
                    blockchain,
                    cumulatedResponsesData,
                    [...this.completedStatuses],
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            }
        }
    }

    getBatchSize() {
        return 20;
    }

    getMinAckResponses(minimumNumberOfNodeReplications) {
        return minimumNumberOfNodeReplications;
    }
}

export default AskService;
