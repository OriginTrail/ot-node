const { RESOLVE_REQUEST_STATUS, HANDLER_ID_STATUS } = require('../constants/constants');

class ResolveService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.handlerIdService = ctx.handlerIdService;
        this.commandExecutor = ctx.commandExecutor;
    }

    async processResolveResponse(command, responseData, errorMessage = null) {
        const { handlerId, numberOfFoundNodes } = command.data;

        const responseStatuses = await this.repositoryModuleManager.getPublishResponsesStatuses(
            handlerId,
        );
        let failedNumber = 0;
        let completedNumber = 0;

        responseStatuses.forEach((responseStatus) => {
            if (responseStatus === RESOLVE_REQUEST_STATUS.FAILED) {
                failedNumber += 1;
            } else {
                completedNumber += 1;
            }
        });

        if (errorMessage) {
            await this.repositoryModuleManager.createResolveResponseRecord(
                RESOLVE_REQUEST_STATUS.FAILED,
                command.data.resolveId,
                errorMessage,
            );

            if (numberOfFoundNodes === failedNumber + 1) {
                await this.handlerIdService.updateHandlerIdStatus(
                    handlerId,
                    HANDLER_ID_STATUS.FAILED,
                );
            }
        } else {
            await this.repositoryModuleManager.createResolveResponseRecord(
                RESOLVE_REQUEST_STATUS.COMPLETED,
                command.data.resolveId,
            );

            if (completedNumber === 0) {
                await this.handlerIdService.cacheHandlerIdData(handlerId, responseData.nquads);

                await this.handlerIdService.updateHandlerIdStatus(
                    handlerId,
                    HANDLER_ID_STATUS.COMPLETED,
                );
                await this.handlerIdService.updateHandlerIdStatus(
                    handlerId,
                    HANDLER_ID_STATUS.RESOLVE.RESOLVE_FETCH_FROM_NODES_END,
                );
                await this.handlerIdService.updateHandlerIdStatus(
                    handlerId,
                    HANDLER_ID_STATUS.RESOLVE.RE,
                );
            }
        }
    }
}

module.exports = ResolveService;
