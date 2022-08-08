const { Mutex } = require('async-mutex');
const OperationService = require('./operation-service');
const {
    OPERATION_ID_STATUS,
    SEARCH_REQUEST_STATUS,
    SEARCH_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
} = require('../constants/constants');
const { result } = require('underscore');

class SearchService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = 'search';
        this.networkProtocol = NETWORK_PROTOCOLS.SEARCH;
        this.operationRequestStatus = SEARCH_REQUEST_STATUS;
        this.operationStatus = SEARCH_STATUS;
        this.errorType = ERROR_TYPE.SEARCH.SEARCH_ERROR;
        this.completedStatuses = [OPERATION_ID_STATUS.COMPLETED];
        this.operationRepositoryMutex = new Mutex();
        this.operationCacheMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const {
            operationId,
            numberOfFoundNodes,
            numberOfNodesInBatch,
            leftoverNodes,
            keyword,
            keywords,
        } = command.data;

        const keywordsStatuses = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            operationId,
            keyword,
            keywords,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${this.networkProtocol} response for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${numberOfResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}`,
        );

        if (completedNumber === 1) {
            let currentResults = await this.operationIdService.getCachedOperationIdData(
                operationId,
            );

            currentResults = currentResults
                ? {
                      ...currentResults,
                      [keyword]: responseData.results,
                  }
                : { [keyword]: responseData.results };

            await this.operationCacheMutex.runExclusive(async () => {
                await this.operationIdService.cacheOperationIdData(operationId, currentResults);
            });

            if (Object.keys(currentResults).length === keywords.length) {
                await this.markOperationAsCompleted(
                    operationId,
                    { currentResults },
                    this.completedStatuses,
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            }
        } else if (
            completedNumber < 1 &&
            (numberOfFoundNodes === numberOfResponses ||
                numberOfResponses % numberOfNodesInBatch === 0)
        ) {
            if (leftoverNodes.length === 0) {
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

    localSearch(keyword, limit, offset) {
        this.logger.info(`Searching for assets indexed with keyword: ${keyword}`);

        return this.tripleStoreModuleManager.searchAssets(keyword, limit, offset);
    }
}

module.exports = SearchService;
