import BaseController from '../base-http-api-controller.js';
import { LOW_BID_SUGGESTION } from '../../../constants/constants.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
    }

    // TODO: We should use new on chain calculation
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

        let { bidSuggestionRange } = req.query;
        try {
            if (!bidSuggestionRange) {
                bidSuggestionRange = LOW_BID_SUGGESTION;
            }
            // TODO: This isn't backwards compatible
            // const bidSuggestion = await this.shardingTableService.getBidSuggestion(
            //     blockchain,
            //     epochsNumber,
            //     assertionSize,
            //     contentAssetStorageAddress,
            //     firstAssertionId,
            //     hashFunctionId,
            //     proximityScoreFunctionsPairId,
            //     bidSuggestionRange,
            // );

            const bidSuggestion = {};
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
