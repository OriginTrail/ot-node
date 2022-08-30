class BaseController {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }
}

module.exports = BaseController;
