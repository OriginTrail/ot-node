import { kcTools } from 'assertion-tools';

class MerkleValidation {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    async calculateRoot(assertion) {
        return kcTools.calculateRoot(assertion);
    }
}

export default MerkleValidation;
