const { Mutex } = require('async-mutex');
const { RESOLVE_REQUEST_STATUS, HANDLER_ID_STATUS } = require('../constants/constants');

const mutex = new Mutex();

class ResolveService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.handlerIdService = ctx.handlerIdService;
        this.commandExecutor = ctx.commandExecutor;
    }

    async processResolveResponse(command, status, responseData, errorMessage = null) {
        const { handlerId, numberOfFoundNodes } = command.data;

        const self = this;
        let responseStatuses = 0;
        await mutex.runExclusive(async () => {
            await self.repositoryModuleManager.createResolveResponseRecord(
                status,
                handlerId,
                errorMessage,
            );

            responseStatuses = await self.repositoryModuleManager.getResolveResponsesStatuses(
                handlerId,
            );
        });

        let failedNumber = 0;
        let completedNumber = 0;

        responseStatuses.forEach((responseStatus) => {
            if (responseStatus === RESOLVE_REQUEST_STATUS.FAILED) {
                failedNumber += 1;
            } else {
                completedNumber += 1;
            }
        });

        if (numberOfFoundNodes === failedNumber) {
            await this.handlerIdService.updateHandlerIdStatus(handlerId, HANDLER_ID_STATUS.FAILED);
        } else if (completedNumber === 1) {
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
}

module.exports = ResolveService;
