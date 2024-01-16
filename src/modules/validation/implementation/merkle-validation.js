import { calculateRoot, getMerkleProof } from 'assertion-tools';

class MerkleValidation {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    calculateRoot(assertion) {
        return calculateRoot(assertion);
    }

    getMerkleProof(nquadsArray, challenge) {
        return getMerkleProof(nquadsArray, challenge);
    }
}

export default MerkleValidation;
