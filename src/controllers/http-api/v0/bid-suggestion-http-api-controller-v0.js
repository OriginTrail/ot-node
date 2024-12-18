import BaseController from '../base-http-api-controller.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async handleRequest(req, res) {
        try {
            const { blockchain, epochsNumber, assertionSize } = req.body;
            const bidSuggestion =
                (await this.blockchainModuleManager.getStakeWeightedAverageAsk(blockchain)) *
                epochsNumber *
                assertionSize;
            this.returnResponse(res, 200, { bidSuggestion });
        } catch (error) {
            this.logger.error(`Unable to get bid suggestion. Error: ${error}`);
            this.returnResponse(res, 500, {
                code: 500,
                message: 'Unable to calculate bid suggestion',
            });
        }
    }
}

export default BidSuggestionController;
