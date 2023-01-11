import BaseController from './base-http-api-controller.js';
import { ERROR_TYPE, OPERATION_ID_STATUS, OPERATION_STATUS } from '../../constants/constants.js';

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async handlePublishRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_INIT_END,
        );

        const { assertion, assertionId, blockchain, contract, tokenId, hashFunctionId } = req.body;
        try {
            await Promise.all([
                this.repositoryModuleManager.createOperationRecord(
                    this.operationService.getOperationName(),
                    operationId,
                    OPERATION_STATUS.IN_PROGRESS,
                ),
                this.operationIdService.cacheOperationIdData(operationId, { assertion }),
            ]);

            this.logger.info(
                `Received asset with assertion id: ${assertionId}, blockchain: ${blockchain}, hub contract: ${contract}, token id: ${tokenId}`,
            );

            await this.commandExecutor.add({
                name: 'validateAssertionCommand',
                sequence: ['networkPublishCommand'],
                delay: 0,
                period: 5000,
                retries: 3,
                data: {
                    assertion,
                    assertionId,
                    blockchain,
                    contract,
                    tokenId,
                    hashFunctionId,
                    operationId,
                },
                transactional: false,
            });
        } catch (error) {
            this.logger.error(
                `Error while initializing publish data: ${error.message}. ${error.stack}`,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.FAILED,
                'Unable to publish data, Failed to process input data!',
                ERROR_TYPE.PUBLISH.PUBLISH_ROUTE_ERROR,
            );
        }
    }
}

export default PublishController;
