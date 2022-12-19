import BaseController from './base-http-api-controller.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.shardingTableService = ctx.shardingTableService;
    }

    async handleBidSuggestionRequest(req, res) {
        // Uncomment when switch to ethers.js
        // if (
        //     !(await this.blockchainModuleManager.isAssetStorageContract(
        //         req.body.blockchain,
        //         req.body.contentAssetStorageAddress,
        //     ))
        // )
        //     this.returnResponse(res, 400, {
        //         code: 400,
        //         message: `Invalid Content Asset Storage Contract Address`,
        //     });
        // if (
        //     !(await this.blockchainModuleManager.isHashFunction(
        //         req.body.blockchain,
        //         req.body.hashFunctionId,
        //     ))
        // )
        //     this.returnResponse(res, 400, {
        //         code: 400,
        //         message: `Invalid Hash Function ID`,
        //     });

        const {
            blockchain,
            epochsNumber,
            assertionSize,
            contentAssetStorageAddress,
            firstAssertionId,
            hashFunctionId,
        } = req.body;

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
