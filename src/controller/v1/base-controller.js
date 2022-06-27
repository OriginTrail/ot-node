const { v1: uuidv1 } = require('uuid');

class BaseController {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.fileService = ctx.fileService;
        this.logger = ctx.logger;
    }

    returnResponse(res, status, data) {
        console.log(JSON.stringify(data, null, 2))
        res.status(status).send(data);
    }

    generateOperationId() {
        const operationId = uuidv1();
        this.logger.debug(`Generated operation id for request ${operationId}`);
        return operationId;
    }
}

module.exports = BaseController;
