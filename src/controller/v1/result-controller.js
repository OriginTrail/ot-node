const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../constants/constants');
const BaseController = require('./base-controller');

const availableOperations = ['publish', 'resolve', 'assertions:search', 'entities:search'];

class ResultController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.handlerIdService = ctx.handlerIdService;
    }

    async handleHttpApiOperationResultRequest(req, res) {
        if (!availableOperations.includes(req.params.operation)) {
            return this.returnResponse(res, 400, {
                code: 400,
                message: `Unsupported operation, available operations are: ${availableOperations}`,
            });
        }

        const { handlerId, operation } = req.params;
        if (!this.handlerIdService.handlerIdInRightFormat(handlerId)) {
            return this.returnResponse(res, 400, {
                code: 400,
                message: 'Handler id is in wrong format',
            });
        }

        try {
            const handlerRecord = await this.handlerIdService.getHandlerIdRecord(handlerId);

            if (handlerRecord) {
                const response = {
                    status: handlerRecord.status,
                };
                if (handlerRecord.status === HANDLER_ID_STATUS.FAILED) {
                    response.data = JSON.parse(handlerRecord.data);
                }

                switch (operation) {
                    case 'assertions:search':
                    case 'entities:search':
                    case 'resolve':
                    case 'publish':
                        response.data = await this.handlerIdService.getCachedHandlerIdData(
                            handlerId,
                        );
                        break;
                    default:
                        break;
                }

                return this.returnResponse(res, 200, response);
            }
            return this.returnResponse(res, 400, {
                code: 400,
                message: `Handler with id: ${handlerId} does not exist.`,
            });
        } catch (e) {
            this.logger.error({
                msg: `Error while trying to fetch ${operation} data for handler id ${handlerId}. Error message: ${e.message}. ${e.stack}`,
                Event_name: ERROR_TYPE.RESULTS_ROUTE_ERROR,
                Event_value1: e.message,
                Id_operation: handlerId,
            });

            return this.returnResponse(res, 400, {
                code: 400,
                message: `Unexpected error at getting results: ${e.message}`,
            });
        }
    }
}

module.exports = ResultController;
