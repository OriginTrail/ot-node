const { Mutex } = require('async-mutex');
const constants = require('../constants/constants');
const {
    NETWORK_PROTOCOLS,
    HANDLER_ID_STATUS,
    PUBLISH_REQUEST_STATUS,
    PUBLISH_STATUS,
} = require('../constants/constants');

const mutex = new Mutex();

class PublishService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.commandExecutor = ctx.commandExecutor;
        this.networkModuleManager = ctx.networkModuleManager;
        this.handlerIdService = ctx.handlerIdService;
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

        const self = this;
        let responses = 0;
        let failedNumber = 0;
        let completedNumber = 0;
        await mutex.runExclusive(async () => {
            await self.repositoryModuleManager.createPublishResponseRecord(
                responseStatus,
                handlerId,
                errorMessage,
            );

            responses = await self.repositoryModuleManager.getPublishResponsesStatuses(handlerId);
        });

        responses.forEach((response) => {
            if (response.status === PUBLISH_REQUEST_STATUS.FAILED) {
                failedNumber += 1;
            } else {
                completedNumber += 1;
            }
        });

        this.logger.debug(
            `Processing publish response. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${responses.length}`,
        );

        if (this.config.minimumReplicationFactor <= completedNumber) {
            await this.markPublishAsCompleted(handlerId, ual, assertionId);
            this.logger.info(
                `Total number of responses: ${
                    failedNumber + completedNumber
                }, failed: ${failedNumber}, completed: ${completedNumber}`,
            );
        } else if (
            numberOfFoundNodes === responses.length ||
            numberOfNodesInBatch === responses.length
        ) {
            if (leftoverNodes.length === 0) {
                await this.markPublishAsFailed(handlerId);
                this.logger.info(
                    `Total number of responses: ${
                        failedNumber + completedNumber
                    }, failed: ${failedNumber}, completed: ${completedNumber}`,
                );
            } else {
                await this.schedulePublishForLeftoverNodes(command, leftoverNodes);
            }
        }
    }

    async handleReceiverCommandError(handlerId, errorMessage, errorName, markFailed, commandData) {
        this.logger.error({
            msg: errorMessage,
        });

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.STORE,
            commandData.remotePeerId,
            messageType,
            handlerId,
            messageData,
        );
    }

    async markPublishAsCompleted(handlerId, ual, assertionId) {
        // mark publish as completed
        this.logger.info(`Finalizing publish for handlerId: ${handlerId}`);

        await this.repositoryModuleManager.updatePublishStatus(handlerId, PUBLISH_STATUS.COMPLETED);

        await this.handlerIdService.cacheHandlerIdData(handlerId, { ual, assertionId });

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_END,
        );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_END,
        );
    }

    async markPublishAsFailed(handlerId) {
        await this.repositoryModuleManager.updatePublishStatus(handlerId, PUBLISH_STATUS.FAILED);

        this.logger.info(
            `Not replicated to enough nodes marking publish as failed for handlerId: ${handlerId}`,
        );

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.FAILED,
            'Not replicated to enough nodes!',
        );
    }

    async schedulePublishForLeftoverNodes(command, leftoverNodes) {
        const commandData = command.data;
        commandData.nodes = leftoverNodes.slice(0, this.config.minimumReplicationFactor);
        if (this.config.minimumReplicationFactor < leftoverNodes.length) {
            commandData.leftoverNodes = leftoverNodes.slice(this.config.minimumReplicationFactor);
        } else {
            commandData.leftoverNodes = [];
        }
        this.logger.debug(
            `Trying to replicate to next batch of ${commandData.nodes.length} nodes, leftover for retry: ${commandData.leftoverNodes.length}`,
        );
        await this.commandExecutor.add({
            name: 'publishStoreCommand',
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }
}

module.exports = PublishService;
