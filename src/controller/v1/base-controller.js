class BaseController {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }
}

export default BaseController;
