import { sha256 } from 'multiformats/hashes/sha2';
import { calculateRoot, getMerkleProof } from 'assertion-tools';

class MerkleValidation {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.hashFunctions = {
            // TODO: Change this nonsense
            0: 'sha256',
        };
    }

    calculateRoot(assertion) {
        return calculateRoot(assertion);
    }

    getMerkleProof(nquadsArray, challenge) {
        return getMerkleProof(nquadsArray, challenge);
    }

    async callHashFunction(hashFunctionId, data) {
        return this[this.hashFunctions[hashFunctionId]](data); // TODO: Change this nonsense
    }

    async sha256(data) {
        const bytes = new TextEncoder().encode(data);
        return `0x${Buffer.from(sha256.digest(bytes).digest).toString('hex')}`;
    }
}

export default MerkleValidation;
