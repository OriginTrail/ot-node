import { v1 as uuidv1 } from 'uuid';

class BaseController {
    constructor(ctx) {
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.fileService = ctx.fileService;
        this.logger = ctx.logger;
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }

    generateOperationId() {
        const operationId = uuidv1();
        this.logger.debug(`Generated operation id for request ${operationId}`);
        return operationId;
    }
}

export default BaseController;
