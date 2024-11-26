import BaseModuleManager from '../base-module-manager.js';

class ValidationModuleManager extends BaseModuleManager {
    getName() {
        return 'validation';
    }

    async calculateRoot(assertion) {
        if (this.initialized) {
            if (!assertion) {
                throw new Error('Calculation failed: Assertion cannot be null or undefined.');
            }
            return this.getImplementation().module.calculateRoot(assertion);
        }
        throw new Error('Validation module is not initialized.');
    }

    async getMerkleProof(assertion, index) {
        if (this.initialized) {
            if (!assertion) {
                throw new Error('Get merkle proof failed: Assertion cannot be null or undefined.');
            }
            return this.getImplementation().module.getMerkleProof(assertion, index);
        }
        throw new Error('Validation module is not initialized.');
    }

    getHashFunctionName(hashFunctionId) {
        if (this.initialized) {
            if (!hashFunctionId) {
                throw new Error(
                    'Getting function name failed: Function ID cannot be null or undefined.',
                );
            }
            return this.getImplementation().module.getHashFunctionName(hashFunctionId);
        }
        throw new Error('Validation module is not initialized.');
    }

    async callHashFunction(hashFunctionId, data) {
        if (this.initialized) {
            if (!!hashFunctionId && !!data) {
                return this.getImplementation().module.callHashFunction(hashFunctionId, data);
            }
            throw new Error('Calling hash fn failed: Values cannot be null or undefined.');
        } else {
            throw new Error('Validation module is not initialized.');
        }
    }
}

export default ValidationModuleManager;
