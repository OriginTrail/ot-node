class BlockchainService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    initialize(implementation) {
        this.blockchain = implementation;
        return this.blockchain.initialize(this.logger);
    }

    getPrivateKey() {
        return this.blockchain.getPrivateKey();
    }

    getPublicKey() {
        return this.blockchain.getPublicKey();
    }

    async sendProofs(assertion) {
        return this.blockchain.sendProofs(assertion);
    }

    async getProofs(proofs) {
        return this.blockchain.getProofs(proofs);
    }

    async healthCheck() {
        return this.blockchain.healthCheck();
    }

    async restartService() {
        return this.blockchain.restartService();
    }
}

module.exports = BlockchainService;
