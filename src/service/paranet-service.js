class ParanetService {
    constructor(ctx) {
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
    }

    async initializeParanetRecord(blockchain, paranetId) {
        const paranetName = await this.blockchainModuleManager.getParanetName(
            blockchain,
            paranetId,
        );
        const paranetDescription = await this.blockchainModuleManager.getDescription(
            blockchain,
            paranetId,
        );
        if (!(await this.repositoryModuleManager.paranetExists(paranetId, blockchain))) {
            await this.repositoryModuleManager.createParanetRecord(
                paranetName,
                paranetDescription,
                paranetId,
                blockchain,
            );
        }
    }

    constructParanetId(blockchain, contract, tokenId) {
        const keyword = this.blockchainModuleManager.encodePacked(
            blockchain,
            ['address', 'uint256'],
            [contract, tokenId],
        );

        return this.blockchainModuleManager.keccak256(blockchain, keyword);
    }

    constructKnowledgeAssetId(blockchain, contract, tokenId) {
        const keyword = this.blockchainModuleManager.encodePacked(
            blockchain,
            ['address', 'uint256'],
            [contract, tokenId],
        );

        return this.blockchainModuleManager.keccak256(blockchain, keyword);
    }

    getParanetRepositoryName(paranetUAL) {
        if (this.ualService.isUAL(paranetUAL)) {
            // Replace : and / with -
            return paranetUAL.replace(/[/:]/g, '-').toLowerCase();
        }
        throw new Error(
            `Unable to get Paranet repository name. Paranet id doesn't have UAL format: ${paranetUAL}`,
        );
    }
}

export default ParanetService;
