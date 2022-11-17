import Web3 from 'web3';

class ServiceAgreementService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.shardingTableService = ctx.this.shardingTableService;
    }

    async generateId(assetTypeContract, tokenId, keyword, hashFunctionId) {
        return this.validationModuleManager.callHashFunction(
            hashFunctionId,
            Web3.utils.encodePacked(assetTypeContract, tokenId, keyword),
        );
    }

    randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    async calculateScore(keyword, blockchain, hashFunctionId) {
        const [peerRecord, keyHash] = await Promise.all([
            this.repositoryModuleManager.getPeerRecord(
                this.networkModuleManager.getPeerId().toB58String(),
                blockchain,
            ),
            this.validationModuleManager.callHashFunction(hashFunctionId, keyword),
        ]);

        const distance = this.shardingTableService.calculateDistance(
            keyHash,
            peerRecord[hashFunctionId],
        );

        // todo update a and b once defined
        const a = 1;
        const b = 1;

        return (a * peerRecord.stake) / (b * distance);
    }
}

export default ServiceAgreementService;
