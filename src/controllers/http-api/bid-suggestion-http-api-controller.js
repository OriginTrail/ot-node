import BaseController from './base-http-api-controller.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.shardingTableService = ctx.shardingTableService;
    }

    async handleBidSuggestionRequest(req, res) {
        const {
            blockchain,
            epochsNumber,
            assertionSize,
            contentAssetStorageAddress,
            firstAssertionId,
            hashFunctionId,
        } = req.query;

        this.returnResponse(res, 200, {
            bidSuggestion: await this.shardingTableService.getBidSuggestion(
                blockchain,
                epochsNumber,
                assertionSize,
                contentAssetStorageAddress,
                firstAssertionId,
                hashFunctionId,
            ),
        });
    }
}

export default BidSuggestionController;
