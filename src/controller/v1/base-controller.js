const { v1: uuidv1 } = require('uuid');

class BaseController {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.fileService = ctx.fileService;
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }

    generateOperationId() {
        return uuidv1();
    }
}

module.exports = BaseController;
