class UALService {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    deriveUAL(blockchain, contract, tokenId) {
        return `did:${blockchain.toLowerCase()}:${contract.toLowerCase()}/${tokenId}`;
    }

    isUAL(ual) {
        const segments = ual.split(':');
        return segments.length === 3 && segments[2].split('/').length >= 2;
    }

    resolveUAL(ual) {
        const segments = ual.split(':');
        const blockchainSegments = segments[2].split('/');
        if (segments.length < 3 || blockchainSegments.length < 2) {
            throw new Error(`UAL doesn't have correct format: ${ual}`);
        }

        return {
            blockchain: segments[1],
            contract: blockchainSegments[0],
            tokenId: blockchainSegments[1],
            assertionId: blockchainSegments.length > 2 ? blockchainSegments[2] : null,
        };
    }
}

module.exports = UALService;
