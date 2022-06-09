const { v1: uuidv1 } = require('uuid');
const { HANDLER_ID_STATUS } = require('../../../modules/constants');

class BaseController {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async generateHandlerId() {
        const handlerId = await this.repositoryModuleManager.createHandlerIdRecord({
            status: HANDLER_ID_STATUS.PENDING,
        });
        return handlerId;
    }

    async updateFailedHandlerId(handlerId, error) {
        if (handlerId !== null) {
            return this.repositoryModuleManager.updateHandlerIdRecord(
                {
                    status: HANDLER_ID_STATUS.FAILED,
                    data: JSON.stringify({ errorMessage: error.message }),
                },
                handlerId,
            );
        }
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }

    generateOperationId() {
        return uuidv1();
    }
}

module.exports = BaseController;
