import BaseController from '../base-http-api-controller.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class LocalStoreController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.dataService = ctx.dataService;
        this.fileService = ctx.fileService;
    }

    async handleRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            null,
            OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INIT_END,
        );
        let assertions;
        if (req.filePath) {
            assertions = this.fileService.readFile(req.filePath);
        } else {
            assertions = req.body;
        }

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

        this.logger.info(
            `Received assertion with assertion ids: ${assertions.map(
                (reqObject) => reqObject.assertionId,
            )}. Operation id: ${operationId}`,
        );

        await this.operationIdService.cacheOperationIdData(operationId, cachedAssertions);

        const commandSequence = ['validateAssetCommand', 'localStoreCommand'];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: {
                operationId,
                blockchain: assertions[0].blockchain,
                contract: assertions[0].contract,
                tokenId: assertions[0].tokenId,
                storeType: assertions[0].storeType,
                paranetUAL: assertions[0].paranetUAL,
            },
            transactional: false,
        });
    }
}

export default LocalStoreController;
