const { v1: uuidv1 } = require('uuid');

class BaseController {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.fileService = ctx.fileService;
        this.logger = ctx.logger;
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }
}

module.exports = BaseController;
