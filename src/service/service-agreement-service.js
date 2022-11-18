import Web3 from 'web3';

class ServiceAgreementService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
    }

    async generateId(assetTypeContract, tokenId, keyword, hashFunctionId) {
        return this.validationModuleManager.callHashFunction(
            hashFunctionId,
            this.blockchainModuleManager.convertHexToAscii(
                Web3.utils.encodePacked(assetTypeContract, tokenId, keyword),
            ),
        );
    }

    async getServiceAgreementData(blockchain, agreementId) {
        return {
            epochsNumber: await this.blockchainModuleManager.getAgreementEpochsNumber(
                blockchain,
                agreementId,
            ),
            startTime: await this.blockchainModuleManager.getAgreementStartTime(
                blockchain,
                agreementId,
            ),
            epochLength: await this.blockchainModuleManager.getAgreementEpochLength(
                blockchain,
                agreementId,
            ),
            tokenAmount: await this.blockchainModuleManager.getAgreementTokenAmount(
                blockchain,
                agreementId,
            ),
            proofWindowOffsetPerc:
                await this.blockchainModuleManager.getAgreementProofWindowOffsetPerc(
                    blockchain,
                    agreementId,
                ),
            scoringFunctionId: await this.blockchainModuleManager.getAgreementScoringFunctionId(
                blockchain,
                agreementId,
            ),
        };
    }

    randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    async calculateScore(keyword, blockchain, hashFunctionId) {
        const encodedKeyword = new TextEncoder().encode(keyword);
        const [peerRecord, keyHash] = await Promise.all([
            this.repositoryModuleManager.getPeerRecord(
                this.networkModuleManager.getPeerId().toB58String(),
                blockchain,
            ),
            this.validationModuleManager.callHashFunction(hashFunctionId, encodedKeyword),
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
