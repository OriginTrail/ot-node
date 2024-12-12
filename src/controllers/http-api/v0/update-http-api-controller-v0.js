import BaseController from '../base-http-api-controller.js';
import {
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    LOCAL_STORE_TYPES,
} from '../../../constants/constants.js';

class UpdateController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async handleRequest(req, res) {
        const { assertion, assertionId, blockchain, contract, tokenId } = req.body;

        this.logger.info(
            `Received asset with assertion id: ${assertionId}, blockchain: ${blockchain}, hub contract: ${contract}, token id: ${tokenId}`,
        );

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.UPDATE.UPDATE_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.UPDATE_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.UPDATE_INIT_END,
        );

        await this.repositoryModuleManager.createOperationRecord(
            this.operationService.getOperationName(),
            operationId,
            OPERATION_STATUS.IN_PROGRESS,
        );

        try {
            await this.operationIdService.cacheOperationIdData(operationId, {
                public: {
                    assertion,
                    assertionId,
                },
                blockchain,
                contract,
                tokenId,
            });

            const commandSequence = ['updateValidateAssetCommand', 'networkUpdateCommand'];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                period: 5000,
                retries: 3,
                data: {
                    blockchain,
                    contract,
                    tokenId,
                    assertionId,
                    operationId,
                    storeType: LOCAL_STORE_TYPES.TRIPLE,
                },
                transactional: false,
            });
        } catch (error) {
            this.logger.error(
                `Error while initializing update data: ${error.message}. ${error.stack}`,
            );

            await this.operationService.markOperationAsFailed(
                operationId,
                blockchain,
                'Unable to update data, Failed to process input data!',
                ERROR_TYPE.UPDATE.UPDATE_ROUTE_ERROR,
            );
        }
    }
}

export default UpdateController;
