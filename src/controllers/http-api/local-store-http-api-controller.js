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

        this.logger.info(
            `Received assertion with assertion ids: ${req.body.map(
                (reqObject) => reqObject.assertionId,
            )}. Operation id: ${operationId}`,
        );

        await this.operationIdService.cacheOperationIdData(operationId, req.body);

        await this.commandExecutor.add({
            name: 'localStoreCommand',
            sequence: [],
            delay: 0,
            data: {
                operationId,
            },
            transactional: false,
        });
    }
}

export default LocalStoreController;
