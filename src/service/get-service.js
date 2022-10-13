import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';
import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
} from '../constants/constants.js';

class GetService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.dataService = ctx.dataService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;

        this.operationName = OPERATIONS.GET;
        this.networkProtocols = NETWORK_PROTOCOLS.GET;
        this.errorType = ERROR_TYPE.GET.GET_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.GET.GET_FETCH_FROM_NODES_END,
            OPERATION_ID_STATUS.GET.GET_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
        this.operationMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const {
            operationId,
            numberOfFoundNodes,
            leftoverNodes,
            keyword,
            batchSize,
            nodesSeen,
            newFoundNodes,
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
            `Processing ${this.operationName} response for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${batchSize} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${numberOfResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}`,
        );

        if (
            responseStatus === OPERATION_REQUEST_STATUS.COMPLETED &&
            completedNumber === this.getMinimumAckResponses()
        ) {
            await this.markOperationAsCompleted(
                operationId,
                { assertion: responseData.nquads },
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        } else if (responseData?.nodes?.length) {
            const leftoverNodesString = leftoverNodes.map((node) => node.id.toString());
            const thisNodeId = this.networkModuleManager.getPeerId().toString();
            const newDiscoveredNodes = responseData.nodes.filter(
                (node) =>
                    node.id !== thisNodeId &&
                    !nodesSeen.includes(node.id) &&
                    !leftoverNodesString.includes(node.id),
            );

            const deserializedNodes = await this.networkModuleManager.deserializePeers(
                newDiscoveredNodes,
            );
            for (const node of deserializedNodes) {
                for (const protocol of this.getNetworkProtocols()) {
                    if (node.protocols.includes(protocol)) {
                        newFoundNodes[node.id.toString()] = { ...node, protocol };
                        break;
                    }
                }
            }
        }

        if (
            completedNumber < this.getMinimumAckResponses() &&
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
                const newLeftoverNodes = await this.networkModuleManager.sortPeers(
                    keyword,
                    leftoverNodes.concat(Object.values(newFoundNodes)),
                    leftoverNodes.length,
                );
                await this.scheduleOperationForLeftoverNodes(command.data, newLeftoverNodes);
            }
        }
    }

    async localGet(assertionId, operationId) {
        this.logger.debug(`Getting assertion: ${assertionId} for operationId: ${operationId}`);

        let nquads = await this.tripleStoreModuleManager.get(assertionId);
        nquads = await this.dataService.toNQuads(nquads, 'application/n-quads');

        this.logger.debug(
            `Assertion: ${assertionId} for operationId: ${operationId} ${
                nquads.length ? '' : 'not'
            } found in local triple store.`,
        );

        if (nquads.length) {
            this.logger.debug(`Number of n-quads retrieved from the database : ${nquads.length}`);
        }

        return nquads;
    }
}

export default GetService;
