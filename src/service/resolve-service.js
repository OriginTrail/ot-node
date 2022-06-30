const { Mutex } = require('async-mutex');
const {
    RESOLVE_REQUEST_STATUS,
    HANDLER_ID_STATUS,
    RESOLVE_STATUS,
} = require('../constants/constants');

const mutex = new Mutex();

class ResolveService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.handlerIdService = ctx.handlerIdService;
        this.commandExecutor = ctx.commandExecutor;
    }

    async processResolveResponse(command, responseStatus, responseData, errorMessage = null) {
        const { handlerId, numberOfFoundNodes, numberOfNodesInBatch, leftoverNodes } = command.data;

        const self = this;
        let responses = 0;
        let failedNumber = 0;
        let completedNumber = 0;
        await mutex.runExclusive(async () => {
            await self.repositoryModuleManager.createResolveResponseRecord(
                responseStatus,
                handlerId,
                errorMessage,
            );

            responses = await self.repositoryModuleManager.getResolveResponsesStatuses(handlerId);
        });

        responses.forEach((response) => {
            if (response.status === RESOLVE_REQUEST_STATUS.FAILED) {
                failedNumber += 1;
            } else {
                completedNumber += 1;
            }
        });

        this.logger.debug(
            `Processing resolve response. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${responses.length}`,
        );

        if (completedNumber === 1) {
            await this.markResolveAsCompleted(handlerId, responseData);
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
                await this.scheduleResolveForLeftoverNodes(command, leftoverNodes);
            }
        }
    }

    async scheduleResolveForLeftoverNodes(command, leftoverNodes) {
        const commandData = command.data;
        commandData.nodes = leftoverNodes.slice(0, this.config.minimumReplicationFactor);
        if (this.config.minimumReplicationFactor < leftoverNodes.length) {
            commandData.leftoverNodes = leftoverNodes.slice(this.config.minimumReplicationFactor);
        } else {
            commandData.leftoverNodes = [];
        }
        this.logger.debug(
            `Trying to resolve to next batch of ${commandData.nodes.length} nodes, leftover for retry: ${commandData.leftoverNodes.length}`,
        );
        await this.commandExecutor.add({
            name: 'resolveCommand',
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }

    async markPublishAsFailed(handlerId) {
        await this.repositoryModuleManager.updateResolveStatus(handlerId, RESOLVE_STATUS.FAILED);

        await this.handlerIdService.updateHandlerIdStatus(handlerId, HANDLER_ID_STATUS.FAILED);
    }

    async markResolveAsCompleted(handlerId, responseData) {
        this.logger.info(`Finalizing resolve for handlerId: ${handlerId}`);

        await this.repositoryModuleManager.updateResolveStatus(handlerId, RESOLVE_STATUS.COMPLETED);

        await this.handlerIdService.cacheHandlerIdData(handlerId, responseData.nquads);

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_FETCH_FROM_NODES_END,
        );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_END,
        );
    }
}

module.exports = ResolveService;
