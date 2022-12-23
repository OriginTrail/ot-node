import BaseModuleManager from '../base-module-manager.js';

class TripleStoreModuleManager extends BaseModuleManager {
    async insertAsset(implementationName, repository, ual, assetNquads, deleteAssetTriples) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.insertAsset(
                repository,
                ual,
                assetNquads,
                deleteAssetTriples,
            );
        }
    }

    async assetExists(implementationName, repository, ual, blockchain, contract, tokenId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.assetExists(
                repository,
                ual,
                blockchain,
                contract,
                tokenId,
            );
        }
    }

    async assetAgreementExists(implementationName, repository, ual, blockchain, contract, tokenId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.assetAgreementExists(
                repository,
                ual,
                blockchain,
                contract,
                tokenId,
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

    async isAssertionIdShared(implementationName, repository, assertionId) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.isAssertionIdShared(
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

    getName() {
        return 'tripleStore';
    }
}

export default TripleStoreModuleManager;
