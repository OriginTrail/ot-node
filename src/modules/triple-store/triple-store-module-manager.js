const BaseModuleManager = require('../base-module-manager');

class TripleStoreModuleManager extends BaseModuleManager {
    getName() {
        return 'tripleStore';
    }

    async insertAsset(assertion, assertionId, assetInfo, ual) {
        if (this.initialized) {
            return this.getImplementation().module.insertAsset(
                assertion,
                assertionId,
                assetInfo,
                ual,
            );
        }
    }

    async assertionExists(uri) {
        if (this.initialized) {
            return this.getImplementation().module.assertionExists(uri);
        }
    }

    async get(uri) {
        if (this.initialized) {
            return this.getImplementation().module.get(uri);
        }
    }

    async assertionsByAsset(uri) {
        if (this.initialized) {
            return this.getImplementation().module.assertionsByAsset(uri);
        }
    }

    async findAssetsByKeyword(query, options, localQuery) {
        if (this.initialized) {
            return this.getImplementation().module.findAssetsByKeyword(query, options, localQuery);
        }
    }

    async findAssertionsByKeyword(query, options, localQuery) {
        if (this.initialized) {
            return this.getImplementation().module.findAssertionsByKeyword(
                query,
                options,
                localQuery,
            );
        }
    }

    async construct(query) {
        if (this.initialized) {
            return this.getImplementation().module.construct(query);
        }
    }

    async findAssertions(nquads) {
        if (this.initialized) {
            return this.getImplementation().module.findAssertions(nquads);
        }
    }

    async select(query) {
        if (this.initialized) {
            return this.getImplementation().module.select(query);
        }
    }

    async healthCheck() {
        if (this.initialized) {
            return this.getImplementation().module.healthCheck();
        }
    }
}

module.exports = TripleStoreModuleManager;
