const BaseModuleManager = require('../base-module-manager');

class BlockchainModuleManager extends BaseModuleManager {
    getName() {
        return 'blockchain';
    }

    getPrivateKey(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getPrivateKey();
        }
    }

    getPublicKey(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getPublicKey();
        }
    }

    getManagementKey(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getManagementKey();
        }
    }

    async deployIdentity(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.deployIdentity();
        }
    }

    identityExists(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.identityExists();
        }
    }

    getIdentity(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getIdentity();
        }
    }

    async createProfile(blockchain, peerId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.createProfile(peerId);
        }
    }

    async getEpochs(blockchain, UAI) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getEpochs(UAI);
        }
    }

    async getBlockNumber(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getBlockNumber();
        }
    }

    getBlockTime(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getBlockTime();
        }
    }

    async getChallenge(blockchain, UAI, epoch) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getChallenge(UAI, epoch);
        }
    }

    async answerChallenge(blockchain, UAI, epoch, proof, leaf, price) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.answerChallenge(
                UAI,
                epoch,
                proof,
                leaf,
                price,
            );
        }
    }

    async getReward(blockchain, UAI, epoch) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getReward(UAI, epoch);
        }
    }

    async getLatestCommitHash(blockchain, contract, tokenId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getLatestCommitHash(contract, tokenId);
        }
    }

    async healthCheck(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.healthCheck();
        }
    }

    async restartService(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.restartService();
        }
    }
}

module.exports = BlockchainModuleManager;
