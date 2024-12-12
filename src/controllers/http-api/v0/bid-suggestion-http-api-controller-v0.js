import BaseController from '../base-http-api-controller.js';
import { LOW_BID_SUGGESTION } from '../../../constants/constants.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager; // i think this is not used anywhere
        this.shardingTableService = ctx.shardingTableService;
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

        const {
            blockchain,
            epochsNumber,
            assertionSize,
            contentAssetStorageAddress,
            firstAssertionId,
            hashFunctionId,
        } = req.query;
        let { bidSuggestionRange } = req.query;
        try {
            const proximityScoreFunctionsPairId = 2;

            if (!bidSuggestionRange) {
                bidSuggestionRange = LOW_BID_SUGGESTION;
            }

            const bidSuggestion = await this.shardingTableService.getBidSuggestion(
                blockchain,
                epochsNumber,
                assertionSize,
                contentAssetStorageAddress,
                firstAssertionId,
                hashFunctionId,
                proximityScoreFunctionsPairId,
                bidSuggestionRange,
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
