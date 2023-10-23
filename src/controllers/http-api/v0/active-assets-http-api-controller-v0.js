import { OPERATION_ID_STATUS, OPERATION_STATUS, ERROR_TYPE } from '../../../constants/constants.js';
import BaseController from '../base-http-api-controller.js';

class ActiveAssetsController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.operationService = ctx.activeAssetsService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async handleRequest() {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.ACTIVE_ASSETS.ACTIVE_ASSETS_START,
        );

        await this.repositoryModuleManager.createOperationRecord(
            this.operationService.getOperationName(),
            operationId,
            OPERATION_STATUS.IN_PROGRESS,
        );

        try {
            // this.logger.info(`ActiveAssets with operation id ${operationId} initiated.`);

            // Which commands should be scheduled
            const commandSequence = [];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    // blockchain,
                    // contract,
                    // tokenId,
                    operationId,
                    // state,
                    // hashFunctionId,
                },
                transactional: false,
            });

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.ACTIVE_ASSETS.ACTIVE_ASSETS_END,
            );
        } catch (error) {
            this.logger.error(
                `Error while initializing get data: ${error.message}. ${error.stack}`,
            );

            await this.operationService.markOperationAsFailed(
                operationId,
                'Unable to fetch active assets!',
                ERROR_TYPE.ACTIVE_ASSETS.ACTIVE_ASSETS_ROUTE_ERROR,
            );
        }
    }
}

export default ActiveAssetsController;
