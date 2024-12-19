import BaseController from '../base-http-api-controller.js';

class FinalityController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.operationService = ctx.finalityService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
        this.validationService = ctx.validationService;
    }

    async handleRequest(req, res) {
        const { ual } = req.query;

        const finality = await this.repositoryModuleManager.getFinalityAcksCount(ual || '');

        if (typeof finality !== 'number')
            return this.returnResponse(res, 400, {
                message: 'Asset with provided UAL was not published to this node.',
            });

        this.returnResponse(res, 200, { finality });
    }
}

export default FinalityController;
