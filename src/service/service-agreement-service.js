import Web3 from 'web3';

class ServiceAgreementService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    async generateId(assetTypeContract, tokenId, keyword, hashingAlgorithm) {
        return this.validationModuleManager.callHashFunction(
            hashingAlgorithm,
            Web3.utils.encodePacked(assetTypeContract, tokenId, keyword),
        );
    }

    async calculateScore() {
        /* const keyHash = await this.networkModuleManager.toHash(keyword);
        const peerHash = await this.repositoryModuleManager.getPeerRecord(this.networkModuleManager.getPeerId, blockchain);
        const distance = this.networkModuleManager.calculateDistance(keyHash, peerHash);

        return 10; */
    }
}

export default ServiceAgreementService;
