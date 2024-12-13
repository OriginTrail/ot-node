import {
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    ERROR_TYPE,
    TRIPLES_VISIBILITY,
} from '../../../constants/constants.js';
import BaseController from '../base-http-api-controller.js';

class GetController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.operationService = ctx.getService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
        this.validationService = ctx.validationService;
    }

    async handleRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.GET.GET_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            null,
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
        let blockchain;
        let contract;
        let knowledgeCollectionId;
        let knowledgeAssetId;
        try {
            const { id, paranetUAL, includeMetadata, contentType } = req.body;
            ({ blockchain, contract, knowledgeCollectionId, knowledgeAssetId } =
                this.ualService.resolveUAL(id));

            this.logger.info(`Get for ${id} with operation id ${operationId} initiated.`);

            // Get assertionMerkleRoot - assertionMerkleRoot
            //

            const commandSequence = ['getValidateAssetCommand', 'getFindShardCommand'];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    ual: id,
                    includeMetadata,
                    blockchain,
                    contract,
                    knowledgeCollectionId,
                    knowledgeAssetId,
                    operationId,
                    paranetUAL,
                    contentType: contentType ?? TRIPLES_VISIBILITY.ALL,
                },
                transactional: false,
            });

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.GET.GET_INIT_END,
            );
        } catch (error) {
            this.logger.error(`Error while initializing get data: ${error.message}.`);

            await this.operationService.markOperationAsFailed(
                operationId,
                blockchain,
                'Unable to get data, Failed to process input data!',
                ERROR_TYPE.GET.GET_ROUTE_ERROR,
            );
        }
    }
}

export default GetController;
