const EllipticDataIntegrityService = require('./elliptic-data-integrity-service');

class DataIntegrityResolver {
    constructor() {
        DataIntegrityResolver.instance = this;
    }

    static getInstance() {
        if (!DataIntegrityResolver.instance) {
            return new DataIntegrityResolver();
        }

        return DataIntegrityResolver.instance;
    }

    resolve(type) {
        switch (type) {
        case 'ECDSA':
        default:
            return EllipticDataIntegrityService.getInstance();
        }
    }
}

module.exports = DataIntegrityResolver;
