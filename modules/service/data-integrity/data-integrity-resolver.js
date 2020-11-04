const EllipticDataIntegrityService = require('./elliptic-data-integrity-service');

class DataIntegrityResolver {
    constructor() {
        if (!DataIntegrityResolver.instance) {
            DataIntegrityResolver.instance = new DataIntegrityResolver();
        }

        return DataIntegrityResolver.instance;
    }

    static getInstance() {
        return new DataIntegrityResolver();
    }

    resolve(type) {
        switch (type.toUpperCase()) {
        case 'ECDSA':
        default:
            return new EllipticDataIntegrityService();
        }
    }
}

module.exports = DataIntegrityResolver;
