import BaseController from './base-http-api-controller.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.shardingTableService = ctx.shardingTableService;
        this.ualService = ctx.ualService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async handleBidSuggestionRequest(req, res) {
        const { blockchain, contract, tokenId, hashFunctionId } = req.body;
        const keyword = await this.ualService.calculateLocationKeyword(
            blockchain,
            contract,
            tokenId,
        );

        this.returnResponse(res, 200, {
            bidSuggestion: await this.shardingTableService.getBidSuggestion(
                blockchain,
                keyword,
                await this.blockchainModuleManager.getR2(blockchain),
                hashFunctionId,
            ),
        });
    }
}

export default BidSuggestionController;
