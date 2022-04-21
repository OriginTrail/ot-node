const { v1: uuidv1 } = require('uuid');
const Models = require('../../../models');
const { HANDLER_ID_STATUS } = require('../../../modules/constants');

class BaseController {
    generateHandlerId() {
        return Models.handler_ids.create({
            status: HANDLER_ID_STATUS.PENDING,
        });
    }

    async updateFailedHandlerId(handlerId, error) {
        if (handlerId !== null) {
            await Models.handler_ids.update(
                {
                    status: HANDLER_ID_STATUS.FAILED,
                    data: JSON.stringify({ errorMessage: error.message }),
                },
                {
                    where: {
                        handler_id: handlerId,
                    },
                },
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
