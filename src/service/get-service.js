import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';
import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
    TRIPLE_STORE_REPOSITORIES,
    ASSET_SYNC_PARAMETERS,
} from '../constants/constants.js';

class GetService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = OPERATIONS.GET;
        this.networkProtocols = NETWORK_PROTOCOLS.GET;
        this.errorType = ERROR_TYPE.GET.GET_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.GET.GET_FETCH_FROM_NODES_END,
            OPERATION_ID_STATUS.GET.GET_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
        this.ualService = ctx.ualService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.operationMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData) {
        const {
            operationId,
            numberOfFoundNodes,
            leftoverNodes,
            keyword,
            batchSize,
            minAckResponses,
            blockchain,
            contract,
            tokenId,
            assertionId,
            assetSync,
            stateIndex,
        } = command.data;

        const keywordsStatuses = await this.getResponsesStatuses(
            responseStatus,
            responseData.errorMessage,
            operationId,
            keyword,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${
                this.operationName
            } response for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${Math.min(
                numberOfFoundNodes,
                batchSize,
            )} number of leftover nodes: ${
                leftoverNodes.length
            }, number of responses: ${numberOfResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}`,
        );
        if (responseData.errorMessage) {
            this.logger.trace(
                `Error message for operation id: ${operationId}, keyword: ${keyword} : ${responseData.errorMessage}`,
            );
        }

        if (
            responseStatus === OPERATION_REQUEST_STATUS.COMPLETED &&
            completedNumber === minAckResponses
        ) {
            await this.markOperationAsCompleted(
                operationId,
                { assertion: responseData.nquads },
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);

            if (assetSync) {
                const assertionIds = await this.blockchainModuleManager.getAssertionIds(
                    blockchain,
                    contract,
                    tokenId,
                );
                const UAL = this.ualService.deriveUAL(blockchain, contract, tokenId);

                this.logger.debug(
                    `ASSET_SYNC: ${responseData.nquads.length} nquads found for asset with ual: ${UAL}, state index: ${stateIndex}, assertionId: ${assertionId}`,
                );

                // Latest update - store in current repository
                if (assertionIds[assertionIds.length - 1] === assertionId) {
                    await this.tripleStoreService.localStoreAsset(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                        assertionId,
                        responseData.nquads,
                        blockchain,
                        contract,
                        tokenId,
                        keyword,
                    );
                } else {
                    await this.tripleStoreService.localStoreAsset(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                        assertionId,
                        responseData.nquads,
                        blockchain,
                        contract,
                        tokenId,
                        keyword,
                    );
                }

                this.logger.debug(
                    `ASSET_SYNC: Updating status for asset sync record with ual: ${UAL}, state index: ${stateIndex}, assertionId: ${assertionId}, status: ${ASSET_SYNC_PARAMETERS.STATUS.COMPLETED}`,
                );
                await this.repositoryModuleManager.updateAssetSyncRecord(
                    blockchain,
                    contract,
                    tokenId,
                    stateIndex,
                    ASSET_SYNC_PARAMETERS.STATUS.COMPLETED,
                );
            }
        }

        if (
            completedNumber < minAckResponses &&
            (numberOfFoundNodes === failedNumber || failedNumber % batchSize === 0)
        ) {
            if (leftoverNodes.length === 0) {
                this.logger.info(
                    `Unable to find assertion on the network for operation id: ${operationId}`,
                );
                await this.markOperationAsCompleted(
                    operationId,
                    {
                        message: 'Unable to find assertion on the network!',
                    },
                    this.completedStatuses,
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            }
        }
    }
}

export default GetService;
