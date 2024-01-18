import BaseController from '../base-http-api-controller.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    async handleRequest(req, res) {
        if ((await this.repositoryModuleManager.getPeersCount(req.query.blockchain)) === 0) {
            const message = `Unable to get bid suggestion. Empty sharding table for blockchain id: ${req.query.blockchain}`;
            this.logger.error(message);
            this.returnResponse(res, 406, {
                code: 406,
                message,
            });
            return;
        }

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
        let { proximityScoreFunctionsPairId } = req.query;
        try {
            // ADD-DOCS
            if (!proximityScoreFunctionsPairId) {
                if (blockchain.startsWith('otp') || blockchain.startsWith('hardhat1'))
                    proximityScoreFunctionsPairId = 1;
                else if (blockchain.startsWith('gnosis') || blockchain.startsWith('hardhat2'))
                    proximityScoreFunctionsPairId = 2;
            }

            const bidSuggestion = await this.shardingTableService.getBidSuggestion(
                blockchain,
                epochsNumber,
                assertionSize,
                contentAssetStorageAddress,
                firstAssertionId,
                hashFunctionId,
                proximityScoreFunctionsPairId,
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
