const BaseModuleManager = require('../base-module-manager');

class ValidationModuleManager extends BaseModuleManager {
    getName() {
        return 'validation';
    }

    calculateHash(string) {
        if (this.initialized) {
            return this.getImplementation().module.calculateHash(string);
        }
    }

    calculateRootHash(assertion) {
        if (this.initialized) {
            return this.getImplementation().module.calculateRootHash(assertion);
        }
    }

    getRootHashProof(assertion, index) {
        if (this.initialized) {
            return this.getImplementation().module.getRootHashProof(assertion, index);
        }
    }

    getMerkleTree(rdf) {
        if (this.initialized) {
            return this.getImplementation().module.getMerkleTree(rdf);
        }
    }

    validateProof(triples, proofs, rootHash) {
        if (this.initialized) {
            return this.getImplementation().module.validateProof(triples, proofs, rootHash);
        }
    }

    sign(content, privateKey) {
        if (this.initialized) {
            return this.getImplementation().module.sign(content, privateKey);
        }
    }

    verify(hash, signature, publicKey) {
        if (this.initialized) {
            return this.getImplementation().module.verify(hash, signature, publicKey);
        }
    }

    recover(content, signature) {
        if (this.initialized) {
            return this.getImplementation().module.recover(content, signature);
        }
    }

    encodeSignature(signature) {
        if (this.initialized) {
            return this.getImplementation().module.encodeSignature(signature);
        }
    }

    decodeSignature(signature) {
        if (this.initialized) {
            return this.getImplementation().module.decodeSignature(signature);
        }
    }

    toChecksum(address) {
        if (this.initialized) {
            return this.getImplementation().module.toChecksum(address);
        }
    }

    hashContent(content) {
        if (this.initialized) {
            return this.getImplementation().module.hashContent(content);
        }
    }

    async getProofs(rdf, nquads) {
        if (this.initialized) {
            return this.getImplementation().module.getProofs(rdf, nquads);
        }
    }
}

module.exports = ValidationModuleManager;
