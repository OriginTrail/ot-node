const { OPERATION_ID_STATUS, ERROR_TYPE } = require('../../constants/constants');
const BaseController = require('./base-controller');

const availableOperations = ['publish', 'get', 'assertions:search', 'entities:search'];

class ResultController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.operationIdService = ctx.operationIdService;
    }

    async handleHttpApiOperationResultRequest(req, res) {
        if (!availableOperations.includes(req.params.operation)) {
            return this.returnResponse(res, 400, {
                code: 400,
                message: `Unsupported operation, available operations are: ${availableOperations}`,
            });
        }

        const { operationId, operation } = req.params;
        if (!this.operationIdService.operationIdInRightFormat(operationId)) {
            return this.returnResponse(res, 400, {
                code: 400,
                message: 'Operation id is in wrong format',
            });
        }

        try {
            const handlerRecord = await this.operationIdService.getOperationIdRecord(operationId);

            if (handlerRecord) {
                const response = {
                    status: handlerRecord.status,
                };
                if (handlerRecord.status === OPERATION_ID_STATUS.FAILED) {
                    response.data = JSON.parse(handlerRecord.data);
                }

                switch (operation) {
                    case 'assertions:search':
                    case 'entities:search':
                    case 'get':
                        if (handlerRecord.status === OPERATION_ID_STATUS.GET.GET_END) {
                            response.data = await this.operationIdService.getCachedOperationIdData(
                                operationId,
                            );
                        }
                        break;
                    case 'publish':
                        if (handlerRecord.status === OPERATION_ID_STATUS.PUBLISH.PUBLISH_END) {
                            response.data = await this.operationIdService.getCachedOperationIdData(
                                operationId,
                            );
                        }
                        break;
                    default:
                        break;
                }

                return this.returnResponse(res, 200, response);
            }
            return this.returnResponse(res, 400, {
                code: 400,
                message: `Handler with id: ${operationId} does not exist.`,
            });
        } catch (e) {
            this.logger.error(
                `Error while trying to fetch ${operation} data for operation id ${operationId}. Error message: ${e.message}. ${e.stack}`,
            );

            return this.returnResponse(res, 400, {
                code: 400,
                message: `Unexpected error at getting results: ${e.message}`,
            });
        }
    }
}

module.exports = ResultController;
