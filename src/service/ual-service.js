class UALService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
    }

    deriveUAL(blockchain, contract, tokenId) {
        return `did:dkg:${blockchain.toLowerCase()}/${contract.toLowerCase()}/${tokenId}`;
    }

    // did:dkg:otp:2043/0x123231/5
    isUAL(ual) {
        const segments = ual.split(':');
        const argsString = segments.length === 3 ? segments[2] : segments[2] + segments[3];
        const args = argsString.split('/');

        return args?.length === 3;
    }

    resolveUAL(ual) {
        const segments = ual.split(':');
        const argsString = segments.length === 3 ? segments[2] : segments[2] + segments[3];
        const args = argsString.split('/');

        if (args?.length !== 3) {
            throw new Error(`UAL doesn't have correct format: ${ual}`);
        }

        return {
            blockchain: args[0],
            contract: args[1],
            tokenId: args[2],
        };
    }

    async calculateLocationKeyword(blockchain, contract, tokenId) {
        const firstAssertionId = await this.blockchainModuleManager.getAssertionIdByIndex(
            blockchain,
            contract,
            tokenId,
            0,
        );
        return this.blockchainModuleManager.encodePacked(
            blockchain,
            ['address', 'bytes32'],
            [contract, firstAssertionId],
        );
    }
}

export default UALService;
