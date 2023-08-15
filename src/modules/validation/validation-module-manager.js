import BaseModuleManager from '../base-module-manager.js';

class ValidationModuleManager extends BaseModuleManager {
    getName() {
        return 'validation';
    }

    calculateRoot(assertion) {
        if (this.initialized) {
            if (assertion === null) {
                throw new Error('Assertion cannot be null!');
            }
            return this.getImplementation().module.calculateRoot(assertion);
        }
    }

    getMerkleProof(assertion, index) {
        if (this.initialized) {
            if (assertion === null) {
                throw new Error('Assertion cannot be null!');
            }
            return this.getImplementation().module.getMerkleProof(assertion, index);
        }
    }

    getHashFunctionName(hashFunctionId) {
        if (this.initialized) {
            if (hashFunctionId === null) {
                throw new Error('Function ID cannot be null!');
            }
            return this.getImplementation().module.getHashFunctionName(hashFunctionId);
        }
    }

    async callHashFunction(hashFunctionId, data) {
        if (this.initialized) {
            if (hashFunctionId === null || data === null) {
                throw new Error('Invalid function parameter');
            }
            return this.getImplementation().module.callHashFunction(hashFunctionId, data);
        }
    }
}

export default ValidationModuleManager;
