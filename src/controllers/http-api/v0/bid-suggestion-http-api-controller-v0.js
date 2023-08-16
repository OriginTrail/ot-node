import BaseController from '../base-http-api-controller.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.shardingTableService = ctx.shardingTableService;
    }

    async handleRequest(req, res) {
        if ((await this.repositoryModuleManager.getPeersCount(req.query.blockchain)) === 0)
            this.returnResponse(res, 400, {
                code: 400,
                message: 'Empty Sharding Table',
            });

        // Uncomment when switch to ethers.js
        // if (
        //     !(await this.blockchainModuleManager.isAssetStorageContract(
        //         req.query.blockchain,
        //         req.query.contentAssetStorageAddress,
        //     ))
        // )
        //     this.returnResponse(res, 400, {
        //         code: 400,
        //         message: `Invalid Content Asset Storage Contract Address`,
        //     });
        // if (
        //     !(await this.blockchainModuleManager.isHashFunction(
        //         req.query.blockchain,
        //         req.query.hashFunctionId,
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
