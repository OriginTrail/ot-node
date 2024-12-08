/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';

import {
    BASE_NAMED_GRAPHS,
    TRIPLE_STORE_REPOSITORY,
    TRIPLES_VISIBILITY,
} from '../constants/constants.js';

class TripleStoreService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.paranetService = ctx.paranetService;
    }

    initializeRepositories() {
        this.repositoryImplementations = {};
        for (const implementationName of this.tripleStoreModuleManager.getImplementationNames()) {
            for (const repository in this.tripleStoreModuleManager.getImplementation(
                implementationName,
            ).module.repositories) {
                this.repositoryImplementations[repository] = implementationName;
            }
        }
    }

    async insertKnowledgeCollection(
        repository,
        knowledgeCollectionUAL,
        knowledgeAssetsUALs,
        knowledgeAssetsStates,
        triples,
        retries = 1,
        retryDelay = 0,
    ) {
        this.logger.info(
            `Inserting Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                `to the Triple Store's ${repository} repository.`,
        );

        const [existsInUnifiedGraph, existsInNamedGraphs] = await Promise.all([
            this.tripleStoreModuleManager.knowledgeCollectionNamedGraphsExist(
                this.repositoryImplementations[repository],
                repository,
                knowledgeCollectionUAL,
            ),
            this.tripleStoreModuleManager.knowledgeCollectionExistsInUnifiedGraph(
                this.repositoryImplementations[repository],
                repository,
                BASE_NAMED_GRAPHS.UNIFIED,
                knowledgeCollectionUAL,
            ),
        ]);

        const knowledgeAssetsStatesUALs = knowledgeAssetsUALs.map(
            (ual, index) => `${ual}:${knowledgeAssetsStates[index]}`,
        );

        // TODO: Add with the introduction of RDF-star mode
        // const tripleAnnotations = this.dataService.createTripleAnnotations(
        //     knowledgeAssetsTriples,
        //     UAL_PREDICATE,
        //     knowledgeAssetsUALs.map((ual) => `<${ual}>`),
        // );
        // const unifiedGraphTriples = [...triples, ...tripleAnnotations];
        const publicKnowledgeAssetsTriples = this.dataService.groupTriplesBySubject(
            triples.public ?? triples,
        );

        const promises = [];

        if (triples.private?.length && !existsInNamedGraphs) {
            const privateKnowledgeAssetsTriples = this.dataService.groupTriplesBySubject(
                triples.private,
            );

            const publicSubjectsMap = new Map(
                publicKnowledgeAssetsTriples.map(([triple], index) => {
                    const [subject] = triple.split(' ');
                    return [subject, index];
                }),
            );

            const privateKnowledgeAssetsStatesUALs = privateKnowledgeAssetsTriples.reduce(
                (result, [triple]) => {
                    const [privateSubject] = triple.split(' '); // groupTriplesBySubject guarantees format
                    if (publicSubjectsMap.has(privateSubject)) {
                        result.push(
                            knowledgeAssetsStatesUALs[publicSubjectsMap.get(privateSubject)],
                        );
                    }
                    return result;
                },
                [],
            );

            if (privateKnowledgeAssetsStatesUALs.length > 0) {
                promises.push(
                    this.tripleStoreModuleManager.createKnowledgeCollectionNamedGraphs(
                        this.repositoryImplementations[repository],
                        repository,
                        privateKnowledgeAssetsStatesUALs,
                        privateKnowledgeAssetsTriples,
                        TRIPLES_VISIBILITY.PRIVATE,
                    ),
                );
            }
        }
        if (!existsInNamedGraphs) {
            promises.push(
                this.tripleStoreModuleManager.createKnowledgeCollectionNamedGraphs(
                    this.repositoryImplementations[repository],
                    repository,
                    knowledgeAssetsStatesUALs,
                    publicKnowledgeAssetsTriples,
                    TRIPLES_VISIBILITY.PUBLIC,
                ),
            );
        }

        if (!existsInUnifiedGraph) {
            const unifiedTriples = triples.public
                ? [...triples.public, ...(triples.private || [])]
                : triples;

            promises.push(
                this.tripleStoreModuleManager.insertKnowledgeCollectionIntoUnifiedGraph(
                    this.repositoryImplementations[repository],
                    repository,
                    BASE_NAMED_GRAPHS.UNIFIED,
                    unifiedTriples,
                ),
            );
        }

        const metadataTriples = knowledgeAssetsUALs
            .map(
                (ual, index) =>
                    `<${ual}> <http://schema.org/states> "${knowledgeAssetsStatesUALs[index]}" .`,
            )
            .join('\n');

        promises.push(
            this.tripleStoreModuleManager.insertKnowledgeCollectionMetadata(
                this.repositoryImplementations[repository],
                repository,
                metadataTriples,
            ),
        );

        let attempts = 0;
        let success = false;

        while (attempts < retries && !success) {
            try {
                await Promise.all(promises);

                success = true;

                this.logger.info(
                    `Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                        `has been successfully inserted to the Triple Store's ${repository} repository.`,
                );
            } catch (error) {
                this.logger.error(
                    `Error during insertion of the Knowledge Collection to the Triple Store's ${repository} repository. ` +
                        `UAL: ${knowledgeCollectionUAL}. Error: ${error.message}`,
                );
                attempts += 1;

                if (attempts < retries) {
                    this.logger.info(
                        `Retrying insertion of the Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                            `to the Triple Store's ${repository} repository. Attempt ${
                                attempts + 1
                            } of ${retries} after delay of ${retryDelay} ms.`,
                    );
                    await setTimeout(retryDelay);
                } else {
                    this.logger.error(
                        `Max retries reached for the insertion of the Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                            `to the Triple Store's ${repository} repository. Rolling back data.`,
                    );

                    // Rollback insertions if data didn't exist before the operation
                    if (!existsInUnifiedGraph) {
                        this.logger.info(
                            `Rolling back Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                                `from the Triple Store's ${repository} repository Unified Graph.`,
                        );
                        await this.tripleStoreModuleManager.deleteKnowledgeCollectionFromUnifiedGraph(
                            this.repositoryImplementations[repository],
                            repository,
                            knowledgeCollectionUAL,
                        );
                    }
                    if (!existsInNamedGraphs) {
                        this.logger.info(
                            `Rolling back Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                                `from the Triple Store's ${repository} repository Named Graphs.`,
                        );
                        await this.tripleStoreModuleManager.deleteKnowledgeCollectionNamedGraphs(
                            this.repositoryImplementations[repository],
                            repository,
                            knowledgeAssetsStatesUALs,
                        );
                    }

                    throw new Error(
                        `Failed to store Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                            `to the Triple Store's ${repository} repository after maximum retries.`,
                    );
                }
            }
        }
    }

    async moveKnowledgeCollectionBetweenUnifiedGraphs(fromRepository, toRepository, ual) {
        const knowledgeCollection =
            await this.tripleStoreModuleManager.getKnowledgeCollectionFromUnifiedGraph(
                this.repositoryImplementations[fromRepository],
                fromRepository,
                BASE_NAMED_GRAPHS.UNIFIED,
                ual,
                false,
            );

        // TODO: Add with the introduction of the RDF-star mode
        // const knowledgeCollectionAnnotations = this.dataService.createTripleAnnotations(
        //     knowledgeCollection,
        //     UAL_PREDICATE,
        //     `<${ual}>`,
        // );
        // const knowledgeCollectionWithAnnotations = [
        //     ...knowledgeCollection,
        //     ...knowledgeCollectionAnnotations,
        // ];

        await Promise.all([
            this.tripleStoreModuleManager.insertKnowledgeCollectionIntoUnifiedGraph(
                this.repositoryImplementations[toRepository],
                toRepository,
                BASE_NAMED_GRAPHS.HISTORICAL_UNIFIED,
                knowledgeCollection,
            ),
            this.tripleStoreModuleManager.deleteUniqueKnowledgeCollectionTriplesFromUnifiedGraph(
                this.repositoryImplementations[toRepository],
                toRepository,
                BASE_NAMED_GRAPHS.UNIFIED,
                ual,
            ),
        ]);
    }

    async checkIfKnowledgeCollectionExistsInUnifiedGraph(
        ual,
        repository = TRIPLE_STORE_REPOSITORY.DKG,
    ) {
        const knowledgeCollectionExists =
            await this.tripleStoreModuleManager.knowledgeCollectionExistsInUnifiedGraph(
                this.repositoryImplementations[repository],
                repository,
                BASE_NAMED_GRAPHS.UNIFIED,
                ual,
            );

        return knowledgeCollectionExists;
    }

    async getAssertion(
        blockchain,
        contract,
        knowledgeCollectionId,
        knowledgeAssetId,
        visibility = TRIPLES_VISIBILITY.PUBLIC,
        repository = TRIPLE_STORE_REPOSITORY.DKG,
    ) {
        // TODO: Use stateId
        const ual = `did:dkg:${blockchain}/${contract}/${knowledgeCollectionId}${
            knowledgeAssetId ? `/${knowledgeAssetId}` : ''
        }`;

        this.logger.debug(`Getting Assertion with the UAL: ${ual}.`);

        let nquads;
        if (knowledgeAssetId) {
            nquads = await this.tripleStoreModuleManager.getKnowledgeAssetNamedGraph(
                this.repositoryImplementations[repository],
                repository,
                // TODO: Add state with implemented update
                `${ual}:0`,
                visibility,
            );
        } else {
            nquads = await this.tripleStoreModuleManager.getKnowledgeCollectionNamedGraphs(
                this.repositoryImplementations[repository],
                repository,
                ual,
                visibility,
            );
        }

        nquads = nquads.split('\n').filter((line) => line !== '');

        this.logger.debug(
            `Assertion: ${ual} ${
                nquads.length ? '' : 'is not'
            } found in the Triple Store's ${repository} repository.`,
        );

        if (nquads.length) {
            this.logger.debug(
                `Number of n-quads retrieved from the Triple Store's ${repository} repository: ${nquads.length}.`,
            );
        }

        return nquads;
    }

    async getAssertionMetadata(
        blockchain,
        contract,
        knowledgeCollectionId,
        knowledgeAssetId,
        repository = TRIPLE_STORE_REPOSITORY.DKG,
    ) {
        const ual = `did:dkg:${blockchain}/${contract}/${knowledgeCollectionId}${
            knowledgeAssetId ? `/${knowledgeAssetId}` : ''
        }`;
        this.logger.debug(`Getting Assertion Metadata with the UAL: ${ual}.`);
        let nquads;
        if (knowledgeAssetId) {
            nquads = await this.tripleStoreModuleManager.getKnowledgeAssetMetadata(
                this.repositoryImplementations[repository],
                repository,
                ual,
            );
        } else {
            nquads = await this.tripleStoreModuleManager.getKnowledgeCollectionMetadata(
                this.repositoryImplementations[repository],
                repository,
                ual,
            );
        }
        nquads = nquads.split('\n').filter((line) => line !== '');

        this.logger.debug(
            `Knowledge Asset Metadata: ${ual} ${
                nquads.length ? '' : 'is not'
            } found in the Triple Store's ${repository} repository.`,
        );

        if (nquads.length) {
            this.logger.debug(
                `Number of n-quads retrieved from the Triple Store's ${repository} repository: ${nquads.length}.`,
            );
        }

        return nquads;
    }

    async construct(query, repository = TRIPLE_STORE_REPOSITORY.DKG) {
        return this.tripleStoreModuleManager.construct(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async select(query, repository = TRIPLE_STORE_REPOSITORY.DKG) {
        return this.tripleStoreModuleManager.select(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async queryVoid(repository, query, namedGraphs = null, labels = null) {
        return this.tripleStoreModuleManager.queryVoid(
            this.repositoryImplementations[repository],
            repository,
            this.buildQuery(query, namedGraphs, labels),
        );
    }
}

export default TripleStoreService;
