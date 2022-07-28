const BaseModuleManager = require('../base-module-manager');

class BlockchainModuleManager extends BaseModuleManager {
    getName() {
        return 'blockchain';
    }

    getPrivateKey() {
        if (this.initialized) {
            return this.getImplementation().module.getPrivateKey();
        }
    }

    getPublicKey() {
        if (this.initialized) {
            return this.getImplementation().module.getPublicKey();
        }
    }

    getManagementKey () {
        if (this.initialized) {
            return this.getImplementation().module.getManagementKey();
        }
    }

    async deployIdentity () {
        if (this.initialized) {
            return this.getImplementation().module.deployIdentity();
        }
    }

    identityExists () {
        if (this.initialized) {
            return this.getImplementation().module.identityExists();
        }
    }

    getIdentity () {
        if (this.initialized) {
            return this.getImplementation().module.getIdentity();
        }
    }

    async createProfile (peerId) {
        if (this.initialized) {
            return this.getImplementation().module.createProfile(peerId);
        }
    }

    async getEpochs (UAI) {
        if (this.initialized) {
            return this.getImplementation().module.getEpochs(UAI);
        }
    }

    async getBlockNumber () {
        if (this.initialized) {
            return this.getImplementation().module.getBlockNumber();
        }
    }

    getBlockTime () {
        if (this.initialized) {
            return this.getImplementation().module.getBlockTime();
        }
    }

    async getChallenge (UAI, epoch) {
        if (this.initialized) {
            return this.getImplementation().module.getChallenge(UAI, epoch);
        }
    }

    async answerChallenge (UAI, epoch, proof, leaf, price) {
        if (this.initialized) {
            return this.getImplementation().module.answerChallenge(UAI, epoch, proof, leaf, price);
        }
    }

    async getReward(UAI, epoch) {
        if (this.initialized) {
            return this.getImplementation().module.getReward(UAI, epoch);
        }
    }

    async getLatestCommitHash(blockchain, contract, tokenId) {
        if (this.initialized) {
            return this.getImplementation().module.getLatestCommitHash(blockchain, contract, tokenId);
        }
    }

    async healthCheck() {
        if (this.initialized) {
            return this.getImplementation().module.healthCheck();
        }
    }

    async restartService() {
        if (this.initialized) {
            return this.getImplementation().module.restartService();
        }
    }
}

module.exports = BlockchainModuleManager;
