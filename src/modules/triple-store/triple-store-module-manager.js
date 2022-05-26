const BaseModuleManager = require('../base-module-manager');

class TripleStoreModuleManager extends BaseModuleManager {
    getName() {
        return 'tripleStore';
    }

    async insert(triples, rootHash) {
        if (this.initialized) {
            return this.getImplementation().module.insert(triples, rootHash);
        }
    }

    async resolve(uri) {
        if (this.initialized) {
            return this.getImplementation().module.resolve(uri);
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
}

module.exports = TripleStoreModuleManager;
