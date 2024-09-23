import BaseController from '../base-http-api-controller.js';
import {
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    LOCAL_STORE_TYPES,
} from '../../../constants/constants.js';

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishParanetService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.dataService = ctx.dataService;
    }

    async handleRequest(req, res) {
        const { assertions, blockchain, contract, tokenId, paranetId } = req.body;
        const hashFunctionId = req.body.hashFunctionId ?? CONTENT_ASSET_HASH_FUNCTION_ID;

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_START,
        );

        this.logger.info(
            `[PARANET PUBLISH] Received asset with public assertion id: ${assertions.public.assertionId}, private assertion id: ${assertions.private.assertionId}, blockchain: ${blockchain}, hub contract: ${contract}, token id: ${tokenId}, operation id: ${operationId}`,
        );
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_PARANET.PUBLISH_PARANET_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_PARANET.PUBLISH_PARANET_INIT_END,
        );
        await this.repositoryModuleManager.createOperationRecord(
            this.operationService.getOperationName(),
            operationId,
            OPERATION_STATUS.IN_PROGRESS,
        );

        try {
            const cachedAssertions = {
                public: {},
                private: {},
            };
            switch (assertions.length) {
                case 1: {
                    const { assertion, assertionId } = assertions[0];
                    cachedAssertions.public = { assertion, assertionId };

                    break;
                }
                case 2: {
                    const isFirstPublic =
                        this.dataService.getPrivateAssertionId(assertions[0].assertion) != null;

                    const publicAssertionData = isFirstPublic ? assertions[0] : assertions[1];
                    const privateAssertionData = isFirstPublic ? assertions[1] : assertions[0];

                    cachedAssertions.public = {
                        assertion: publicAssertionData.assertion,
                        assertionId: publicAssertionData.assertionId,
                    };
                    cachedAssertions.private = {
                        assertion: privateAssertionData.assertion,
                        assertionId: privateAssertionData.assertionId,
                    };

                    break;
                }
                default:
                    throw Error('Unexpected number of assertions in local store');
            }
            // Expand this to hold both private and publish assertion like in local store
            await this.operationIdService.cacheOperationIdData(operationId, {
                cachedAssertions,
                blockchain,
                contract,
                tokenId,
                paranetId,
            });

            // Expand publishValidateAssetCommand to check if paranetPublish and do additional validations
            // Or just create publishParanetValidateAssetCommand
            const commandSequence = ['publishParanetValidateAssetCommand'];

            // Backwards compatibility check - true for older clients
            if (req.body.localStore) {
                commandSequence.push('localStoreCommand');
            }

            // Use different publish command
            commandSequence.push('networkPublishCommand');

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                period: 5000,
                retries: 3,
                data: {
                    // assertionId,
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
                `Error while initializing publish paranet data: ${error.message}. ${error.stack}`,
            );

            await this.operationService.markOperationAsFailed(
                operationId,
                blockchain,
                'Unable to publish paranet data, Failed to process input data!',
                ERROR_TYPE.PUBLISH.PUBLISH_ROUTE_ERROR,
            );
        }
    }
}

export default PublishController;
