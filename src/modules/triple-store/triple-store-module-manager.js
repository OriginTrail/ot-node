import BaseModuleManager from '../base-module-manager.js';

class TripleStoreModuleManager extends BaseModuleManager {
    initializeParanetRepository(repository) {
        return this.getImplementation().module.initializeParanetRepository(repository);
    }

    async insetAssertionInNamedGraph(implementationName, repository, namedGraph, nquads) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.insetAssertionInNamedGraph(
                repository,
                namedGraph,
                nquads,
            );
        }
    }

    async deleteUniqueKnowledgeCollectionTriplesFromUnifiedGraph(
        implementationName,
        repository,
        namedGraph,
        ual,
    ) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.deleteUniqueKnowledgeCollectionTriplesFromUnifiedGraph(
                repository,
                namedGraph,
                ual,
            );
        }
    }

    async getKnowledgeCollectionFromUnifiedGraph(
        implementationName,
        repository,
        namedGraph,
        ual,
        sort,
    ) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.getKnowledgeCollectionFromUnifiedGraph(repository, namedGraph, ual, sort);
        }
    }

    async getKnowledgeCollectionPublicFromUnifiedGraph(
        implementationName,
        repository,
        namedGraph,
        ual,
        sort,
    ) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.getKnowledgeCollectionPublicFromUnifiedGraph(
                repository,
                namedGraph,
                ual,
                sort,
            );
        }
    }

    async knowledgeCollectionExistsInUnifiedGraph(implementationName, repository, namedGraph, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.knowledgeCollectionExistsInUnifiedGraph(repository, namedGraph, ual);
        }
    }

    async deleteUniqueKnowledgeAssetTriplesFromUnifiedGraph(
        implementationName,
        repository,
        namedGraph,
        ual,
    ) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.deleteUniqueKnowledgeAssetTriplesFromUnifiedGraph(repository, namedGraph, ual);
        }
    }

    async getKnowledgeAssetFromUnifiedGraph(implementationName, repository, namedGraph, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.getKnowledgeAssetFromUnifiedGraph(repository, namedGraph, ual);
        }
    }

    async getKnowledgeAssetPublicFromUnifiedGraph(implementationName, repository, namedGraph, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.getKnowledgeAssetPublicFromUnifiedGraph(repository, namedGraph, ual);
        }
    }

    async knowledgeAssetExistsInUnifiedGraph(implementationName, repository, namedGraph, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.knowledgeAssetExistsInUnifiedGraph(repository, namedGraph, ual);
        }
    }

    async createKnowledgeCollectionNamedGraphs(
        implementationName,
        repository,
        uals,
        assetsNQuads,
        visibility,
    ) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.createKnowledgeCollectionNamedGraphs(
                repository,
                uals,
                assetsNQuads,
                visibility,
            );
        }
    }

    async deleteKnowledgeCollectionNamedGraphs(implementationName, repository, uals) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.deleteKnowledgeCollectionNamedGraphs(repository, uals);
        }
    }

    async getKnowledgeCollectionNamedGraphs(implementationName, repository, ual, visibility, sort) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.getKnowledgeCollectionNamedGraphs(repository, ual, visibility, sort);
        }
    }

    async knowledgeCollectionNamedGraphsExist(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.knowledgeCollectionNamedGraphsExist(repository, ual);
        }
    }

    async deleteKnowledgeAssetNamedGraph(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.deleteKnowledgeAssetNamedGraph(
                repository,
                ual,
            );
        }
    }

    async getKnowledgeAssetNamedGraph(implementationName, repository, ual, visibility) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getAssertionFromNamedGraph(
                repository,
                ual,
                visibility,
            );
        }
    }

    async knowledgeAssetNamedGraphExists(implementationName, repository, name) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.knowledgeAssetNamedGraphExists(
                repository,
                name,
            );
        }
    }

    async insertKnowledgeCollectionMetadata(implementationName, repository, metadataNQuads) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.insertKnowledgeCollectionMetadata(repository, metadataNQuads);
        }
    }

    async deleteKnowledgeCollectionMetadata(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.deleteKnowledgeCollectionMetadata(repository, ual);
        }
    }

    async getKnowledgeCollectionMetadata(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getKnowledgeCollectionMetadata(
                repository,
                ual,
            );
        }
    }

    async getKnowledgeAssetMetadata(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.getKnowledgeAssetMetadata(
                repository,
                ual,
            );
        }
    }

    async knowledgeCollectionMetadataExists(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.knowledgeCollectionMetadataExists(repository, ual);
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

    async findAllNamedGraphsByUAL(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.findAllNamedGraphsByUAL(
                repository,
                ual,
            );
        }
    }

    async findAllSubjectsWithGraphNames(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(implementationName).module.findAllSubjectsWithGraphNames(
                repository,
                ual,
            );
        }
    }

    async getKCPrivateAssertionIdentifierTriple(implementationName, repository, ual) {
        if (this.getImplementation(implementationName)) {
            return this.getImplementation(
                implementationName,
            ).module.getKCPrivateAssertionIdentifierTriple(repository, ual);
        }
    }

    getName() {
        return 'tripleStore';
    }
}

export default TripleStoreModuleManager;
