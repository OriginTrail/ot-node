class BaseController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.protocolService = ctx.protocolService;
    }

    returnResponse(res, status, data) {
        res.status(status).send(data);
    }

    getCommandSequence(protocol) {
        return this.protocolService.getReceiverCommandSequence(protocol);
    }
}

export default BaseController;
