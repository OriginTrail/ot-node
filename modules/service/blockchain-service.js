const Blockchain = require('../../external/web3-blockchain-service');

class BlockchainService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    initialize() {
        this.implementation = new Blockchain({
            networkId: this.config.blockchain[0].networkId,
            hubContractAddress: this.config.blockchain[0].hubContractAddress,
            publicKey: this.config.blockchain[0].publicKey,
            privateKey: this.config.blockchain[0].privateKey,
            rpcEndpoints: this.config.blockchain[0].rpcEndpoints,
        });
        return this.implementation.initialize(this.logger);
    }

    getName() {
        return this.implementation.getName();
    }

    getPrivateKey() {
        return this.implementation.getPrivateKey();
    }

    getPublicKey() {
        return this.implementation.getPublicKey();
    }

    async createAssertionRecord(stateCommitHash, issuer) {
        return this.implementation.createAssertionRecord(stateCommitHash, issuer);
    }

    async createAsset(uai, stateCommitHash, tokenAmount) {
        return this.implementation.registerAsset(
            uai,
            stateCommitHash,
            tokenAmount,
        );
    }

    async updateAsset(UAI, newStateCommitHash) {
        return this.implementation.updateAsset(UAI, newStateCommitHash);
    }

    async getAssertionProofs(assertionId) {
        return this.implementation.getAssertionProofs(assertionId);
    }

    async getAssetProofs(uai) {
        return this.implementation.getAssetProofs(uai);
    }

    async healthCheck() {
        return this.implementation.healthCheck();
    }

    async restartService() {
        return this.implementation.restartService();
    }
}

module.exports = BlockchainService;
