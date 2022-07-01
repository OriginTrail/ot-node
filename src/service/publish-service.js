const OperationService = require('./operation-service');
const {
    HANDLER_ID_STATUS,
    PUBLISH_REQUEST_STATUS,
    PUBLISH_STATUS,
} = require('../constants/constants');

class PublishService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = 'resolve';
        this.operationRequestStatus = PUBLISH_REQUEST_STATUS;
        this.operationStatus = PUBLISH_STATUS;
        this.completedStatuses = [
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_END,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_END,
        ];
    }

    async processPublishResponse(command, responseStatus, errorMessage = null) {
        const {
            handlerId,
            ual,
            assertionId,
            numberOfFoundNodes,
            leftoverNodes,
            numberOfNodesInBatch,
        } = command.data;

        const { responses, failedNumber, completedNumber } = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            command.data,
        );

        if (this.config.minimumReplicationFactor <= completedNumber) {
            await this.markOperationAsCompleted(
                handlerId,
                { ual, assertionId },
                this.completedStatuses,
            );
            this.logResponsesSummary(completedNumber, failedNumber);
        } else if (
            numberOfFoundNodes === responses.length ||
            numberOfNodesInBatch === responses.length
        ) {
            if (leftoverNodes.length === 0) {
                await this.markOperationAsFailed(handlerId, 'Not replicated to enough nodes!');
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(
                    command,
                    leftoverNodes,
                    'publishStoreCommand',
                );
            }
        }
    }

    async createRepositoryResponseRecord(responseStatus, handlerId, errorMessage) {
        return this.repositoryModuleManager.createPublishResponseRecord(
            responseStatus,
            handlerId,
            errorMessage,
        );
    }

    async getRepositoryResponsesStatuses(handlerId) {
        return this.repositoryModuleManager.getPublishResponsesStatuses(handlerId);
    }

    async updateRepositoryOperationStatus(handlerId, status) {
        await this.repositoryModuleManager.updatePublishStatus(handlerId, status);
    }
}

module.exports = PublishService;
