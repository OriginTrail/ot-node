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
}

export default ValidationModuleManager;
