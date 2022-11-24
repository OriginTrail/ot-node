/* eslint-disable no-restricted-globals */
class UALService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
    }

    deriveUAL(blockchain, contract, tokenId) {
        return `did:${blockchain.toLowerCase()}:${contract.toLowerCase()}/${tokenId}`;
    }

    isUAL(ual) {
        const segments = ual.split(':');
        if (!segments || !segments.length || segments.length !== 3) return false;

        const blockchainSegments = segments[2].split('/');
        if (!blockchainSegments || !blockchainSegments.length || blockchainSegments.length < 2)
            return false;

        return !isNaN(blockchainSegments[1]);
    }

    resolveUAL(ual) {
        const segments = ual.split(':');
        const blockchainSegments = segments[2].split('/');

        if (
            segments.length !== 3 ||
            blockchainSegments.length < 2 ||
            isNaN(blockchainSegments[1])
        ) {
            throw new Error(`UAL doesn't have correct format: ${ual}`);
        }

        return {
            blockchain: segments[1],
            contract: blockchainSegments[0],
            tokenId: blockchainSegments[1],
            assertionId: blockchainSegments.length > 2 ? blockchainSegments[2] : null,
        };
    }

    // TODO: discuss if we want to change to Hash(contract/tokenId/aId1) for the locationHash
    async calculateLocationHash(blockchain, contract, tokenId) {
        const ual = this.deriveUAL(blockchain, contract, tokenId);
        const firstAssertionId = await this.blockchainModuleManager.getAssertionByIndex(
            blockchain,
            contract,
            tokenId,
            0,
        );
        return this.validationModuleManager.callHashFunction(0, `${ual}/${firstAssertionId}`);
    }
}

export default UALService;
