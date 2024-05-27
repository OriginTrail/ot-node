class ParanetService {
    constructor(ctx) {
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
    }

    async initializeParanetRecord(blockchain, paranetId) {
        const paranetMetadata = await this.blockchainModuleManager.getParanetMetadata(
            blockchain,
            paranetId,
        );
        if (!(await this.repositoryModuleManager.paranetExists(paranetId, blockchain))) {
            await this.repositoryModuleManager.createParanetRecord(
                paranetMetadata.name,
                paranetMetadata.description,
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

    getParanetRepositoryName(paranetId) {
        if (this.ualService.isUAL(paranetId)) {
            // Replace : and / with -
            return paranetId.replace(/[/:]/g, '-');
        }
        throw new Error(
            `Unable to get Paranet repository name. Paranet id doesn't have UAL format: ${paranetId}`,
        );
    }
}

export default ParanetService;
