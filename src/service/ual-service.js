class UALService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    deriveUAL(blockchain, contract, tokenId) {
        return `did:dkg:${blockchain.toLowerCase()}/${contract.toLowerCase()}/${tokenId}`;
    }

    // did:dkg:otp:2043/0x123231/5
    isUAL(ual) {
        const parts = ual.replace('did:', '').replace('dkg:', '').split('/');
        if (parts.length === 3) {
            // eslint-disable-next-line no-restricted-globals
            return this.isContract(parts[1]) && !isNaN(Number(parts[2]));
        }
        if (parts.length === 2) {
            const parts2 = parts[0].split(':');
            // eslint-disable-next-line no-restricted-globals
            return parts2.length === 2 && this.isContract(parts2[1]) && !isNaN(Number(parts[1]));
        }
    }

    resolveUAL(ual) {
        const parts = ual.replace('did:', '').replace('dkg:', '').split('/');
        if (parts.length === 3) {
            const contract = parts[1];
            if (this.isContract(contract)) {
                throw new Error(`Invalid contract format: ${contract}`);
            }
            return { blockchain: parts[0], contract, tokenId: Number(parts[2]) };
        }
        if (parts.length === 2) {
            const parts2 = parts[0].split(':');
            const contract = parts2[1];
            if (this.isContract(contract)) {
                throw new Error(`Invalid contract format: ${contract}`);
            }
            return { blockchain: parts2[0], contract, tokenId: Number(parts[1]) };
        }

        throw new Error(`UAL doesn't have correct format: ${ual}`);
    }

    isContract(contract) {
        const contractRegex = /^0x[a-fA-F0-9]{40}$/;
        return contractRegex.test(contract);
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
