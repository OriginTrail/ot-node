import BaseController from './base-http-api-controller.js';

import { OPERATION_ID_STATUS } from '../../constants/constants.js';

class QueryController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
    }

    async handleQueryRequest(req, res) {
        const { query, type: queryType } = req.body;

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.QUERY.QUERY_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.QUERY.QUERY_INIT_END,
        );

        await this.commandExecutor.add({
            name: 'queryCommand',
            sequence: [],
            delay: 0,
            data: { query, queryType, repository: req.body.repository, operationId },
            transactional: false,
        });
    }
}

export default QueryController;
