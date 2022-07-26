const OperationService = require('./operation-service');
const {
    GET_REQUEST_STATUS,
    OPERATION_ID_STATUS,
    GET_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
} = require('../constants/constants');

class GetService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.dataService = ctx.dataService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;

        this.operationName = 'get';
        this.networkProtocol = NETWORK_PROTOCOLS.GET;
        this.operationRequestStatus = GET_REQUEST_STATUS;
        this.operationStatus = GET_STATUS;
        this.errorType = ERROR_TYPE.GET.GET_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.GET.GET_FETCH_FROM_NODES_END,
            OPERATION_ID_STATUS.GET.GET_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const { operationId, numberOfFoundNodes, numberOfNodesInBatch, leftoverNodes, keyword } =
            command.data;

        const keywordsStatuses = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            operationId,
            keyword,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${this.networkProtocol} response for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${numberOfResponses}`,
        );

        if (completedNumber === 1) {
            await this.markOperationAsCompleted(
                operationId,
                responseData.nquads,
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        } else if (numberOfFoundNodes === failedNumber || numberOfNodesInBatch === failedNumber) {
            if (leftoverNodes.length === 0) {
                await this.markOperationAsFailed(
                    operationId,
                    'Unable to find assertion on the network!',
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            }
        }
    }

    async localGet(ual, assertionId, operationId) {
        const graphName = `${ual}/${assertionId}`;
        const nquads = {
            metadata: '',
            data: '',
        };
        const assertionExists = await this.tripleStoreModuleManager.assertionExists(graphName);
        if (!assertionExists) return nquads;

        this.logger.debug(`Getting assertion: ${graphName} for operationId: ${operationId}`);

        const getAndNormalize = async (uri) => {
            const getd = await this.tripleStoreModuleManager.get(uri);
            return this.dataService.toNQuads(getd, 'application/n-quads');
        };

        const getPromises = [
            getAndNormalize(`${graphName}/metadata`).then((result) => {
                nquads.metadata = result;
            }),
            getAndNormalize(`${graphName}/data`).then((result) => {
                nquads.data = result;
            }),
        ];
        await Promise.allSettled(getPromises);

        const found = nquads.metadata.length && nquads.data.length;

        this.logger.debug(
            `Assertion: ${graphName} for operationId: ${operationId} ${
                found ? '' : 'not'
            } found in local database.`,
        );

        if (found) {
            this.logger.debug(
                `Number of n-quads retrieved from the database is: metadata: ${nquads.metadata.length}, data: ${nquads.data.length}`,
            );
        }

        return nquads;
    }
}

module.exports = GetService;
