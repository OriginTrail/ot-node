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
        } else {
            // TODO: Write proper Error msg
            throw new Error(
                `Unable to get Paranet repository name. Paranet id doesn't have correct format: ${paranetId}`,
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
            return paranetId.replace('/', '-');
        }
        throw new Error(
            `Unable to get Paranet repository name. Paranet id doesn't have correct format: ${paranetId}`,
        );
    }
}

export default ParanetService;
