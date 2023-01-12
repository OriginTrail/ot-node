import BaseController from './base-http-api-controller.js';

import { OPERATION_ID_STATUS } from '../../constants/constants.js';

class LocalStoreController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
    }

    async handleLocalStoreRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INIT_END,
        );

        const { assertion, assertionId } = req.body;

        await this.operationIdService.cacheOperationIdData(operationId, { assertion });

        this.logger.info(`Received assertion with assertion id: ${assertionId}.`);

        await this.commandExecutor.add({
            name: 'localStoreCommand',
            sequence: [],
            delay: 0,
            data: {
                assertion,
                assertionId,
                operationId,
            },
            transactional: false,
        });
    }
}

export default LocalStoreController;
