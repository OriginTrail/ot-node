const BaseModuleManager = require('../base-module-manager');

class TripleStoreModuleManager extends BaseModuleManager {
    getName() {
        return 'tripleStore';
    }

    async insertAssertion(assertionNquads, assertionId) {
        if (this.initialized) {
            return this.getImplementation().module.insertAssertion(assertionNquads, assertionId);
        }
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

    async insertIndex(assertionNquads, assertionId, indexNquads, keyword, assetNquads) {
        if (this.initialized) {
            return this.getImplementation().module.insertIndex(
                assertionNquads,
                assertionId,
                indexNquads,
                keyword,
                assetNquads,
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

    async searchAssets(keyword, limit, offset) {
        if (this.initialized) {
            return this.getImplementation().module.searchAssets(keyword, limit, offset);
        }
    }

    async construct(query) {
        if (this.initialized) {
            return this.getImplementation().module.construct(query);
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
