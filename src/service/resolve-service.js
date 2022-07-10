const OperationService = require('./operation-service');
const {
    RESOLVE_REQUEST_STATUS,
    HANDLER_ID_STATUS,
    RESOLVE_STATUS,
    NETWORK_PROTOCOLS,
} = require('../constants/constants');

class ResolveService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.dataService = ctx.dataService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;

        this.operationName = 'resolve';
        this.networkProtocol = NETWORK_PROTOCOLS.RESOLVE;
        this.operationRequestStatus = RESOLVE_REQUEST_STATUS;
        this.operationStatus = RESOLVE_STATUS;
        this.completedStatuses = [
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_FETCH_FROM_NODES_END,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_END,
        ];
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const { handlerId, numberOfFoundNodes, numberOfNodesInBatch, leftoverNodes, keyword } =
            command.data;

        const keywordsStatuses = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            handlerId,
            keyword,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${this.networkProtocol} response for handlerId: ${handlerId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${numberOfResponses}`,
        );

        if (completedNumber === 1) {
            await this.markOperationAsCompleted(
                handlerId,
                responseData.nquads,
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        } else if (numberOfFoundNodes === failedNumber || numberOfNodesInBatch === failedNumber) {
            if (leftoverNodes.length === 0) {
                await this.markOperationAsFailed(
                    handlerId,
                    'Unable to find assertion on the network!',
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            }
        }
    }

    async localResolve(ual, assertionId, handlerId) {
        const graphName = `${ual}/${assertionId}`;
        const nquads = {
            metadata: '',
            data: '',
        };
        const assertionExists = await this.tripleStoreModuleManager.assertionExists(graphName);
        if (!assertionExists) return nquads;

        this.logger.debug(`Resolving assertion: ${graphName} for handlerId: ${handlerId}`);

        const resolveAndNormalize = async (uri) => {
            const resolved = await this.tripleStoreModuleManager.resolve(uri);
            return this.dataService.toNQuads(resolved, 'application/n-quads');
        };

        const resolvePromises = [
            resolveAndNormalize(`${graphName}/metadata`).then((result) => {
                nquads.metadata = result;
            }),
            resolveAndNormalize(`${graphName}/data`).then((result) => {
                nquads.data = result;
            }),
        ];
        await Promise.allSettled(resolvePromises);

        const found = nquads.metadata.length && nquads.data.length;

        this.logger.debug(
            `Assertion: ${graphName} for handlerId: ${handlerId} ${
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

module.exports = ResolveService;
