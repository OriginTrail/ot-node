import BaseController from '../base-http-api-controller.js';
import {
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    LOCAL_STORE_TYPES,
} from '../../../constants/constants.js';

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationService = ctx.publishService;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager; // this is not used
        this.pendingStorageService = ctx.pendingStorageService;
    }

    async handleRequest(req, res) {
        const { assertion, assertionMerkleRoot, blockchain, contract, tokenId } = req.body;

        this.logger.info(
            `Received asset with assertion root: ${assertionMerkleRoot}, blockchain: ${blockchain}`,
        );

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_INIT_END,
        );
        await this.repositoryModuleManager.createOperationRecord(
            this.operationService.getOperationName(),
            operationId,
            OPERATION_STATUS.IN_PROGRESS,
        );

        try {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.PUBLISH.PUBLISH_CACHE_OPERATION_ID_DATA_TO_MEMORY_START,
                operationId,
                blockchain,
            );
            await this.operationIdService.cacheOperationIdDataToMemory(operationId, {
                assertion,
                assertionMerkleRoot,
            });
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.PUBLISH.PUBLISH_CACHE_OPERATION_ID_DATA_TO_MEMORY_END,
                operationId,
                blockchain,
            );

            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.PUBLISH.PUBLISH_CACHE_OPERATION_ID_DATA_TO_FILE_START,
                operationId,
                blockchain,
            );
            await this.operationIdService.cacheOperationIdDataToFile(operationId, {
                assertion,
                assertionMerkleRoot,
            });
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.PUBLISH.PUBLISH_CACHE_OPERATION_ID_DATA_TO_FILE_END,
                operationId,
                blockchain,
            );

            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.PUBLISH.PUBLISH_CACHE_ASSERTION_START,
                operationId,
                blockchain,
            );
            await this.pendingStorageService.cacheAssertion(
                operationId,
                assertionMerkleRoot,
                assertion,
            );
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.PUBLISH.PUBLISH_CACHE_ASSERTION_END,
                operationId,
                blockchain,
            );

            const commandSequence = ['publishFindShardCommand'];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                period: 5000,
                retries: 3,
                data: {
                    assertionMerkleRoot,
                    blockchain,
                    operationId,
                    contract,
                    tokenId,
                    isOperationV0: true,
                    storeType: LOCAL_STORE_TYPES.TRIPLE,
                },
                transactional: false,
            });
        } catch (error) {
            this.logger.error(
                `Error while initializing publish data: ${error.message}. ${error.stack}`,
            );

            await this.operationService.markOperationAsFailed(
                operationId,
                blockchain,
                'Unable to publish data, Failed to process input data!',
                ERROR_TYPE.PUBLISH.PUBLISH_ROUTE_ERROR,
            );
        }
    }
}

export default PublishController;
