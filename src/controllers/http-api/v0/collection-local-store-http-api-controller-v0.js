import BaseController from '../base-http-api-controller.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class LocalStoreController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.dataService = ctx.dataService;
    }

    async handleRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.COLLECTION_LOCAL_STORE.COLLECTION_LOCAL_STORE_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            null,
            OPERATION_ID_STATUS.COLLECTION_LOCAL_STORE.COLLECTION_LOCAL_STORE_INIT_END,
        );

        const { body } = req;
        const cachedKnowledgeAssets = {
            merkleRoot: body.merkleRoot,
            knowledgeAssets: body.knowledgeAssets,
        };

        this.logger.info(
            `Received Knowledge Collection with ${body.knowledgeAssets.length} Knowledge Assets. Merkle Root: ${body.merkleRoot}. Operation id: ${operationId}`,
        );

        await this.operationIdService.cacheOperationIdData(operationId, cachedKnowledgeAssets);

        await this.commandExecutor.add({
            name: 'collectionLocalStoreCommand',
            delay: 0,
            data: {
                operationId,
                blockchain: body.blockchain,
                contract: body.contract,
            },
            transactional: false,
        });
    }
}

export default LocalStoreController;
