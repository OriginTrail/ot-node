class BaseController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.protocolService = ctx.protocolService;
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }
}

export default BaseController;
