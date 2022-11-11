import Web3 from 'web3';

class ServiceAgreementService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async generateId(assetTypeContract, tokenId, keyword, hashingAlgorithm) {
        return this.validationModuleManager.callHashFunction(
            hashingAlgorithm,
            Web3.utils.encodePacked(assetTypeContract, tokenId, keyword),
        );
    }

    calculateScore() {
        // todo calculate score
        return 10;
    }
}

export default ServiceAgreementService;
