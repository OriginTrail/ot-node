const OperationService = require('./operation-service');
const {
    HANDLER_ID_STATUS,
    PUBLISH_REQUEST_STATUS,
    PUBLISH_STATUS,
    NETWORK_PROTOCOLS,
} = require('../constants/constants');

class PublishService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = 'publish';
        this.networkProtocol = NETWORK_PROTOCOLS.STORE;
        this.operationRequestStatus = PUBLISH_REQUEST_STATUS;
        this.operationStatus = PUBLISH_STATUS;
        this.completedStatuses = [
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_END,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_END,
        ];
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const {
            handlerId,
            ual,
            assertionId,
            numberOfFoundNodes,
            leftoverNodes,
            numberOfNodesInBatch,
            keyword,
        } = command.data;

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

        if (completedNumber >= this.config.minimumReplicationFactor) {
            let allCompleted = true;
            for (const key in keywordsStatuses) {
                if (keywordsStatuses[key].completedNumber < this.config.minimumReplicationFactor) {
                    allCompleted = false;
                    break;
                }
            }
            if (allCompleted) {
                await this.markOperationAsCompleted(
                    handlerId,
                    { ual, assertionId },
                    this.completedStatuses,
                );
                this.logResponsesSummary(completedNumber, failedNumber);
            }
        } else if (
            numberOfFoundNodes === numberOfResponses ||
            numberOfNodesInBatch === numberOfResponses
        ) {
            if (leftoverNodes.length === 0) {
                await this.markOperationAsFailed(handlerId, 'Not replicated to enough nodes!');
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(
                    command,
                    leftoverNodes,
                    'publishScheduleMessagesCommand',
                );
            }
        }
    }
}

module.exports = PublishService;
