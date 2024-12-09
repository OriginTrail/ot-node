import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';
import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
} from '../constants/constants.js';

class PublishFinalityService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = OPERATIONS.PUBLISH_FINALITY;
        this.networkProtocols = NETWORK_PROTOCOLS.PUBLISH_FINALITY;
        this.errorType = ERROR_TYPE.PUBLISH_FINALITY.PUBLISH_FINALITY_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.PUBLISH_FINALITY.PUBLISH_FINALITY_FETCH_FROM_NODES_END,
            OPERATION_ID_STATUS.PUBLISH_FINALITY.PUBLISH_FINALITY_END,
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
        const { operationId, blockchain } = command.data;

        const responseStatusesFromDB = await this.getResponsesStatuses(
            responseStatus,
            responseData.errorMessage,
            operationId,
        );

        const { completedNumber, failedNumber } = responseStatusesFromDB[operationId];

        this.logger.debug(
            `Processing ${this.operationName} response with status: ${responseStatus} for operationId: ${operationId}. ` +
                `Completed: ${completedNumber}, Failed: ${failedNumber}`,
        );
        if (responseData.errorMessage) {
            this.logger.trace(
                `Error message for operation id: ${operationId} : ${responseData.errorMessage}`,
            );
        }

        if (responseStatus === OPERATION_REQUEST_STATUS.COMPLETED) {
            await this.markOperationAsCompleted(
                operationId,
                blockchain,
                {
                    completedNodes: 1,
                    allNodesReplicatedData: true,
                },
                [...this.completedStatuses],
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        } else {
            await this.markOperationAsFailed(
                operationId,
                blockchain,
                `Unable to replicate data on the network!`,
                this.errorType,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        }
    }

    async getBatchSize() {
        throw Error('getBatchSize not implemented');
    }

    async getMinAckResponses() {
        throw Error('getMinAckResponses not implemented');
    }
}

export default PublishFinalityService;
