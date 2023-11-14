import { ethers } from 'ethers';
import { calculateRoot, getMerkleProof } from 'assertion-tools';

class MerkleValidation {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.hashFunctions = {
            // TODO: Change this nonsense
            1: 'sha256',
        };
    }

    calculateRoot(assertion) {
        return calculateRoot(assertion);
    }

    getMerkleProof(nquadsArray, challenge) {
        return getMerkleProof(nquadsArray, challenge);
    }

    async callHashFunction(hashFunctionId, data) {
        const hashFunctionName = this.getHashFunctionName(hashFunctionId);
        return this[hashFunctionName](data); // TODO: Change this nonsense
    }

    getHashFunctionName(hashFunctionId) {
        return this.hashFunctions[hashFunctionId];
    }

    async sha256(data) {
        if (!ethers.isBytesLike(data)) {
            const bytesLikeData = ethers.toUtf8Bytes(data);
            return ethers.sha256(bytesLikeData);
        }
        return ethers.sha256(data);
    }
}

export default MerkleValidation;
