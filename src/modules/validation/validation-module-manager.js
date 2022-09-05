import BaseModuleManager from '../base-module-manager.js';

class ValidationModuleManager extends BaseModuleManager {
    getName() {
        return 'validation';
    }

    calculateRoot(assertion) {
        if (this.initialized) {
            return this.getImplementation().module.calculateRoot(assertion);
        }
    }

    getMerkleProof(assertion, index) {
        if (this.initialized) {
            return this.getImplementation().module.getMerkleProof(assertion, index);
        }
    }
}

export default ValidationModuleManager;
