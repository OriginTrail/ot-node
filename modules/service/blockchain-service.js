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

    async sendProofs(assertion) {
        return this.implementation.sendProofs(assertion);
    }

    async getProofs(proofs) {
        return this.implementation.getProofs(proofs);
    }

    async healthCheck() {
        return this.implementation.healthCheck();
    }

    async restartService() {
        return this.implementation.restartService();
    }
}

module.exports = BlockchainService;
