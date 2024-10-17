import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';

import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
} from '../constants/constants.js';

class PublishParanetService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = OPERATIONS.PUBLISH_PARANET;
        this.networkProtocols = NETWORK_PROTOCOLS.STORE_PARANET;
        this.errorType = ERROR_TYPE.PUBLISH_PARANET.PUBLISH_PARANET_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.PUBLISH_PARANET.PUBLISH_PARANET_REPLICATE_END,
            OPERATION_ID_STATUS.PUBLISH_PARANET.PUBLISH_PARANET_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
        this.operationMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const {
            operationId,
            blockchain,
            numberOfFoundNodes,
            leftoverNodes,
            keyword,
            batchSize,
            minAckResponses,
        } = command.data;

        const keywordsStatuses = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            operationId,
            keyword,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${
                this.operationName
            } response with status: ${responseStatus} for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${Math.min(
                numberOfFoundNodes,
                batchSize,
            )} number of leftover nodes: ${
                leftoverNodes.length
            }, number of responses: ${numberOfResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}, minimum replication factor: ${minAckResponses}`,
        );
        if (responseData.errorMessage) {
            this.logger.trace(
                `Error message for operation id: ${operationId}, keyword: ${keyword} : ${responseData.errorMessage}`,
            );
        }

        if (
            responseStatus === OPERATION_REQUEST_STATUS.COMPLETED &&
            (minAckResponses === 0 || completedNumber > minAckResponses)
        ) {
            let allCompleted = true;
            for (const key in keywordsStatuses) {
                if (keywordsStatuses[key].completedNumber < minAckResponses) {
                    allCompleted = false;
                    break;
                }
            }
            if (allCompleted) {
                await this.markOperationAsCompleted(
                    operationId,
                    blockchain,
                    null,
                    this.completedStatuses,
                );
                this.logResponsesSummary(completedNumber, failedNumber);
                this.logger.info(
                    `${this.operationName} with operation id: ${operationId} with status: ${
                        this.completedStatuses[this.completedStatuses.length - 1]
                    }`,
                );
            }
        } else if (
            completedNumber < minAckResponses &&
            (numberOfFoundNodes === numberOfResponses || numberOfResponses % batchSize === 0)
        ) {
            if (leftoverNodes.length === 0) {
                await this.markOperationAsFailed(
                    operationId,
                    blockchain,
                    'Not replicated to enough nodes!',
                    this.errorType,
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            }
        }
    }
}

export default PublishParanetService;
