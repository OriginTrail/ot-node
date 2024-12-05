import { OPERATION_ID_STATUS, OPERATION_STATUS, ERROR_TYPE } from '../../../constants/constants.js';
import BaseController from '../base-http-api-controller.js';

class FinalityController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.operationService = ctx.finalityService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
        this.validationService = ctx.validationService;
    }

    async handleRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.FINALITY.FINALITY_START,
        );

        const { ual, blockchain } = req.body;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FINALITY.FINALITY_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.repositoryModuleManager.createOperationRecord(
            this.operationService.getOperationName(),
            operationId,
            OPERATION_STATUS.IN_PROGRESS,
        );

        try {
            this.logger.info(`Finality for ${ual} with operation id ${operationId} initiated.`);

            const commandSequence = ['finalityFindShardCommand', 'networkFinalityCommand'];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    ual,
                    operationId,
                },
                transactional: false,
            });

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.FINALITY.FINALITY_END,
            );
        } catch (error) {
            this.logger.error(`Error while initializing finality: ${error.message}.`);

            await this.operationService.markOperationAsFailed(
                operationId,
                blockchain,
                'Unable to check finality, Failed to process input data!',
                ERROR_TYPE.FINALITY.FINALITY_ERROR,
            );
        }
    }
}

export default FinalityController;