import { BigNumber } from 'ethers';
import BaseController from '../base-http-api-controller.js';
import { ONE_ETHER } from '../../../constants/constants.js';

class BidSuggestionController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async handleRequest(req, res) {
        try {
            const { blockchain, epochsNumber, assertionSize } = req.body;
            const promises = [
                this.blockchainModuleManager.getTimeUntilNextEpoch(blockchain),
                this.blockchainModuleManager.getEpochLength(blockchain),
                this.blockchainModuleManager.getStakeWeightedAverageAsk(blockchain),
            ];
            const [timeUntilNextEpoch, epochLength, stakeWeightedAverageAsk] = await Promise.all(
                promises,
            );
            const timeUntilNextEpochScaled = BigNumber.from(timeUntilNextEpoch)
                .mul(ONE_ETHER)
                .div(BigNumber.from(epochLength));
            const epochsNumberScaled = BigNumber.from(epochsNumber).mul(ONE_ETHER);
            const storageTime = timeUntilNextEpochScaled.add(epochsNumberScaled);
            const bidSuggestion = BigNumber.from(stakeWeightedAverageAsk)
                .mul(storageTime)
                .mul(BigNumber.from(assertionSize))
                .div(ONE_ETHER);
            this.returnResponse(res, 200, { bidSuggestion: bidSuggestion.toString() });
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
