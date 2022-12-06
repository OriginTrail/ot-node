import BaseModuleManager from '../base-module-manager.js';

class TripleStoreModuleManager extends BaseModuleManager {
    async initialize() {
        await super.initialize();
        this.repositoryImplementations = {};
        for (const name of this.getImplementationNames()) {
            for (const repository of Object.keys(
                this.getImplementation(name).module.config.repositories,
            )) {
                this.repositoryImplementations[repository] = name;
            }
        }
    }

    async insertAsset(repository, ual, assertionId, assetNquads) {
        const implementationName = this.repositoryImplementations[repository];
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.insertAsset(
                repository,
                ual,
                assertionId,
                assetNquads,
            );
        }
    }

    async assetExists(repository, ual, blockchain, contract, tokenId) {
        const implementationName = this.repositoryImplementations[repository];
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

    async insertAssertion(repository, assertionId, assertionNquads) {
        const implementationName = this.repositoryImplementations[repository];
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.insertAssertion(
                repository,
                assertionId,
                assertionNquads,
            );
        }
    }

    async assertionExists(repository, uri) {
        const implementationName = this.repositoryImplementations[repository];
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.assertionExists(
                repository,
                uri,
            );
        }
    }

    async getAssertion(repository, uri) {
        const implementationName = this.repositoryImplementations[repository];
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getAssertion(repository, uri);
        }
    }

    async construct(repository, query) {
        const implementationName = this.repositoryImplementations[repository];
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.construct(repository, query);
        }
    }

    async select(repository, query) {
        const implementationName = this.repositoryImplementations[repository];
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.select(repository, query);
        }
    }

    getName() {
        return 'tripleStore';
    }
}

export default TripleStoreModuleManager;
