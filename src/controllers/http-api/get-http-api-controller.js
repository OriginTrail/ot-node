import {
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    DEFAULT_GET_STATE,
    ERROR_TYPE,
} from '../../constants/constants.js';
import BaseController from './base-http-api-controller.js';

class GetController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.operationService = ctx.getService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
    }

    async handleGetRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.GET.GET_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_INIT_START,
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
            const { id } = req.body;

            if (!this.ualService.isUAL(id)) {
                throw Error('Requested id is not a UAL');
            }

            const { blockchain, contract, tokenId } = this.ualService.resolveUAL(id);
            const state = req.body.state ?? DEFAULT_GET_STATE;
            const hashFunctionId = req.body.hashFunctionId ?? CONTENT_ASSET_HASH_FUNCTION_ID;

            this.logger.info(`Get for ${id} with operation id ${operationId} initiated.`);

            const commandSequence = [
                'getAssertionIdCommand',
                'localGetCommand',
                'networkGetCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    blockchain,
                    contract,
                    tokenId,
                    operationId,
                    state,
                    hashFunctionId,
                },
                transactional: false,
            });

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.GET.GET_INIT_END,
            );
        } catch (error) {
            this.logger.error(
                `Error while initializing get data: ${error.message}. ${error.stack}`,
            );

            await this.operationService.markOperationAsFailed(
                operationId,
                'Unable to get data, Failed to process input data!',
                ERROR_TYPE.GET.GET_ROUTE_ERROR,
            );
        }
    }
}

export default GetController;
