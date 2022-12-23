import BaseController from './base-http-api-controller.js';

import { OPERATION_ID_STATUS } from '../../constants/constants.js';

class QueryController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
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

        const commandSequence = ['queryCommand'];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: { query, queryType, operationId },
            transactional: false,
        });
    }
}

export default QueryController;
