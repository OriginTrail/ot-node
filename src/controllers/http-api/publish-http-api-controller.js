import BaseController from './base-http-api-controller.js';
import {
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    LOCAL_STORE_TYPES,
} from '../../constants/constants.js';

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

        const { assertion, assertionId, blockchain, contract, tokenId } = req.body;
        const hashFunctionId = req.body.hashFunctionId ?? CONTENT_ASSET_HASH_FUNCTION_ID;
        try {
            await this.repositoryModuleManager.createOperationRecord(
                this.operationService.getOperationName(),
                operationId,
                OPERATION_STATUS.IN_PROGRESS,
            );

            this.logger.info(
                `Received asset with assertion id: ${assertionId}, blockchain: ${blockchain}, hub contract: ${contract}, token id: ${tokenId}`,
            );

            await this.operationIdService.cacheOperationIdData(operationId, {
                public: {
                    assertion,
                    assertionId,
                },
                blockchain,
                contract,
                tokenId,
            });

            const commandSequence = ['validateAssetCommand'];

            // Backwards compatibility check - true for older clients
            if (req.body.localStore) {
                commandSequence.push('localStoreCommand');
            }

            commandSequence.push('networkPublishCommand');

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                period: 5000,
                retries: 3,
                data: {
                    assertionId,
                    blockchain,
                    contract,
                    tokenId,
                    hashFunctionId,
                    operationId,
                    storeType: LOCAL_STORE_TYPES.TRIPLE,
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
