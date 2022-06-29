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

    async createAssertionRecord(stateCommitHash, rootHash, issuer) {
        if (this.initialized) {
            return this.getImplementation().module.createAssertionRecord(stateCommitHash, rootHash, issuer);
        }
    }

    async registerAsset(uai, type, alsoKnownAs, stateCommitHash, rootHash, tokenAmount) {
        if (this.initialized) {
            return this.getImplementation().module.registerAsset(
                uai,
                type,
                alsoKnownAs,
                stateCommitHash,
                rootHash,
                tokenAmount,
            );
        }
    }

    async updateAsset(UAI, newStateCommitHash, rootHash) {
        if (this.initialized) {
            return this.getImplementation().module.updateAsset(UAI, newStateCommitHash, rootHash);
        }
    }

    async getAssertionProofs(assertionId) {
        if (this.initialized) {
            return this.getImplementation().module.getAssertionProofs(assertionId);
        }
    }

    async getAssetProofs(ual) {
        if (this.initialized) {
            return this.getImplementation().module.getAssetProofs(ual);
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
