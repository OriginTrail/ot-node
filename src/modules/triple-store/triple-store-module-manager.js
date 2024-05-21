import BaseModuleManager from '../base-module-manager.js';

class TripleStoreModuleManager extends BaseModuleManager {
    initializeRepository(repository) {
        return this.getImplementation().module.initializeRepository(repository);
    }

    async insertAssetAssertionMetadata(implementationName, repository, assetNquads) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.insertAssetAssertionMetadata(
                repository,
                assetNquads,
            );
        }
    }

    async updateAssetNonAssertionMetadata(implementationName, repository, ual, assetNquads) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.updateAssetMetadata(
                repository,
                ual,
                assetNquads,
            );
        }
    }

    async deleteAssetMetadata(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.deleteAssetMetadata(
                repository,
                ual,
            );
        }
    }

    async assetExists(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.assetExists(repository, ual);
        }
    }

    async insertAssetAssertionLink(implementationName, repository, ual, assertionId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.insertAssetAssertionLink(
                repository,
                ual,
                assertionId,
            );
        }
    }

    async deleteAssetAssertionLink(implementationName, repository, ual, assertionId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.deleteAssetAssertionLink(
                repository,
                ual,
                assertionId,
            );
        }
    }

    async updateAssetAssertionLink(
        implementationName,
        repository,
        ual,
        oldAssertionId,
        newAssertionId,
    ) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.updateAssetAssertionLink(
                repository,
                ual,
                oldAssertionId,
                newAssertionId,
            );
        }
    }

    async getAssetAssertionLinks(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getAssetAssertionLinks(
                repository,
                ual,
            );
        }
    }

    async assetAssertionLinkExists(implementationName, repository, ual, assertionId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.assetAssertionLinkExists(
                repository,
                ual,
                assertionId,
            );
        }
    }

    async insertAssertion(implementationName, repository, assertionId, assertionNquads) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.insertAssertion(
                repository,
                assertionId,
                assertionNquads,
            );
        }
    }

    async assertionExists(implementationName, repository, uri) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.assertionExists(
                repository,
                uri,
            );
        }
    }

    async countAssetsWithAssertionId(implementationName, repository, assertionId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.countAssetsWithAssertionId(
                repository,
                assertionId,
            );
        }
    }

    async getAssetAssertionIds(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getAssetAssertionIds(
                repository,
                ual,
            );
        }
    }

    async getAssertion(implementationName, repository, assertionId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getAssertion(
                repository,
                assertionId,
            );
        }
    }

    async deleteAssertion(implementationName, repository, assertionId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.deleteAssertion(
                repository,
                assertionId,
            );
        }
    }

    async construct(implementationName, repository, query) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.construct(repository, query);
        }
    }

    async select(implementationName, repository, query) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.select(repository, query);
        }
    }

    async queryVoid(implementationName, repository, query) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.queryVoid(repository, query);
        }
    }

    async deleteRepository(implementationName, repository) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.deleteRepository(repository);
        }
    }

    async getRepositorySparqlEndpoint(implementationName, repository) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getRepositorySparqlEndpoint(
                repository,
            );
        }
    }

    getName() {
        return 'tripleStore';
    }
}

export default TripleStoreModuleManager;
