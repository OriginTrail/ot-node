import { sha256 } from 'multiformats/hashes/sha2';
import { calculateRoot, getMerkleProof } from 'assertion-tools';

class MerkleValidation {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.hashingAlgorithms = {
            sha256,
        };
    }

    calculateRoot(assertion) {
        return calculateRoot(assertion);
    }

    getMerkleProof(nquadsArray, challenge) {
        return getMerkleProof(nquadsArray, challenge);
    }

    async callHashFunction(hashingAlgorithm, data) {
        return this.hashingAlgorithms[hashingAlgorithm](data);
    }

    async sha256(data) {
        return `0x${Buffer.from((await sha256.digest(data)).digest)}`;
    }
}

export default MerkleValidation;
