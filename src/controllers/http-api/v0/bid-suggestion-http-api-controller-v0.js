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
        try {
            const bidSuggestion = await this.shardingTableService.getBidSuggestion(
                blockchain,
                epochsNumber,
                assertionSize,
                contentAssetStorageAddress,
                firstAssertionId,
                hashFunctionId,
            );

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
