import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';
import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
    TRIPLE_STORE_REPOSITORIES,
    PARANET_NODES_ACCESS_POLICIES,
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
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.paranetService = ctx.paranetService;
        this.operationMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData) {
        const {
            operationId,
            blockchain,
            numberOfFoundNodes,
            leftoverNodes,
            keyword,
            batchSize,
            minAckResponses,
            contract,
            tokenId,
            assertionId,
            assetSync,
            stateIndex,
            paranetSync,
            paranetTokenId,
            paranetLatestAsset,
            paranetMetadata,
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
            } response with status: ${responseStatus} for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${Math.min(
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
                blockchain,
                { assertion: responseData.nquads },
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);

            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

            if (paranetSync) {
                this.logger.debug(
                    `Paranet sync: ${responseData.nquads.length} nquads found for asset with ual: ${ual}, state index: ${stateIndex}, assertionId: ${assertionId}`,
                );

                const paranetNodesAccessPolicy =
                    PARANET_NODES_ACCESS_POLICIES[paranetMetadata.nodesAccessPolicy];

                let repository;
                let publicAssertionId;

                if (!paranetLatestAsset) {
                    repository =
                        paranetNodesAccessPolicy === 'OPEN'
                            ? TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY
                            : TRIPLE_STORE_REPOSITORIES.PRIVATE_HISTORY;
                    publicAssertionId = assertionId;
                } else {
                    const paranetUAL = this.ualService.deriveUAL(
                        blockchain,
                        contract,
                        paranetTokenId,
                    );

                    repository = this.paranetService.getParanetRepositoryName(paranetUAL);
                    publicAssertionId = responseData.syncedAssetRecord.publicAssertionId;

                    if (responseData.privateNquads) {
                        await this.tripleStoreService.localStoreAsset(
                            repository,
                            responseData.syncedAssetRecord.privateAssertionId,
                            responseData.privateNquads,
                            blockchain,
                            contract,
                            tokenId,
                            keyword,
                        );
                    }

                    await this.repositoryModuleManager.createParanetSyncedAssetRecord(
                        blockchain,
                        ual,
                        paranetUAL,
                        responseData.syncedAssetRecord.publicAssertionId,
                        responseData.syncedAssetRecord.privateAssertionId,
                        responseData.syncedAssetRecord.sender,
                        responseData.syncedAssetRecord.transactionHash,
                    );
                }

                await this.tripleStoreService.localStoreAsset(
                    repository,
                    publicAssertionId,
                    responseData.nquads,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                );
            } else if (assetSync) {
                this.logger.debug(
                    `Asset sync: ${responseData.nquads.length} nquads found for asset with ual: ${ual}, state index: ${stateIndex}, assertionId: ${assertionId}`,
                );

                await this.tripleStoreService.localStoreAsset(
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    assertionId,
                    responseData.nquads,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
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
                    blockchain,
                    {
                        message: 'Unable to find assertion on the network!',
                    },
                    this.completedStatuses,
                );
                this.logResponsesSummary(completedNumber, failedNumber);
                if (assetSync) {
                    const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
                    this.logger.debug(
                        `ASSET_SYNC: No nquads found for asset with ual: ${ual}, state index: ${stateIndex}, assertionId: ${assertionId}`,
                    );
                }
            } else {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            }
        }
    }
}

export default GetService;
