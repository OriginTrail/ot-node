const OperationService = require('./operation-service');
const {
    RESOLVE_REQUEST_STATUS,
    HANDLER_ID_STATUS,
    RESOLVE_STATUS,
} = require('../constants/constants');

class ResolveService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.dataService = ctx.dataService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;

        this.operationName = 'resolve';
        this.operationRequestStatus = RESOLVE_REQUEST_STATUS;
        this.operationStatus = RESOLVE_STATUS;
        this.completedStatuses = [
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_FETCH_FROM_NODES_END,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_END,
        ];
    }

    async processResolveResponse(command, responseStatus, responseData, errorMessage = null) {
        const { handlerId, numberOfFoundNodes, numberOfNodesInBatch, leftoverNodes } = command.data;

        const { responses, failedNumber, completedNumber } = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            command.data,
        );

        console.log({ responses, failedNumber, completedNumber });

        if (completedNumber === 1) {
            console.log(JSON.stringify(responseData, null, 2));
            await this.markOperationAsCompleted(
                handlerId,
                responseData.nquads,
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        } else if (
            failedNumber === responses.length &&
            (numberOfFoundNodes === responses.length || numberOfNodesInBatch === responses.length)
        ) {
            if (leftoverNodes.length === 0) {
                await this.markOperationAsFailed(
                    handlerId,
                    'Unable to find assertion on the network!',
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(
                    command,
                    leftoverNodes,
                    'resolveCommand',
                );
            }
        }
    }

    async createRepositoryResponseRecord(responseStatus, handlerId, errorMessage) {
        return this.repositoryModuleManager.createResolveResponseRecord(
            responseStatus,
            handlerId,
            errorMessage,
        );
    }

    async getRepositoryResponsesStatuses(handlerId) {
        return this.repositoryModuleManager.getResolveResponsesStatuses(handlerId);
    }

    async updateRepositoryOperationStatus(handlerId, status) {
        await this.repositoryModuleManager.updateResolveStatus(handlerId, status);
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

        if (nquads.metadata.length && nquads.data.length) {
            this.logger.debug(
                `Assertion: ${graphName} for handlerId: ${handlerId} found in local database.`,
            );
            this.logger.debug(
                `Number of metadata n-quads retrieved from the database is ${nquads.metadata.length}`,
            );
            this.logger.debug(
                `Number of data n-quads retrieved from the database is ${nquads.data.length}`,
            );
        } else {
            this.logger.debug(
                `Assertion: ${graphName} for handlerId: ${handlerId} not found in local database.`,
            );
        }

        return nquads;
    }
}

module.exports = ResolveService;
