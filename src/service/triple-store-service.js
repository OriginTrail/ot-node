/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';
import { formatAssertion } from 'assertion-tools';

import { SCHEMA_CONTEXT, UAL_PREDICATE, BASE_NAMED_GRAPHS } from '../constants/constants.js';

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
        knowledgeAssetsStatesUALs,
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

        const tripleAnnotations = this.dataService.createTripleAnnotations(
            triples,
            UAL_PREDICATE,
            `<${knowledgeCollectionUAL}>`,
        );
        const unifiedGraphTriples = [...triples, ...tripleAnnotations];

        const knowledgeAssetsTriples = this.dataService.groupTriplesBySubject(triples);

        const promises = [];

        if (!existsInNamedGraphs) {
            promises.push(
                this.tripleStoreModuleManager.createKnowledgeCollectionNamedGraphs(
                    this.repositoryImplementations[repository],
                    repository,
                    knowledgeAssetsStatesUALs,
                    knowledgeAssetsTriples,
                ),
            );
        }

        if (!existsInUnifiedGraph) {
            promises.push(
                this.tripleStoreModuleManager.insertKnowledgeCollectionIntoUnifiedGraph(
                    this.repositoryImplementations[repository],
                    repository,
                    BASE_NAMED_GRAPHS.UNIFIED,
                    unifiedGraphTriples,
                ),
            );
        }

        const metadataTriples = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@graph': knowledgeAssetsStatesUALs.map((stateUAL) => {
                const ualWithoutState = stateUAL.substring(0, stateUAL.lastIndexOf(':'));

                return {
                    '@id': ualWithoutState,
                    states: [stateUAL],
                };
            }),
        });

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

        const knowledgeCollectionAnnotations = this.dataService.createTripleAnnotations(
            knowledgeCollection,
            UAL_PREDICATE,
            `<${ual}>`,
        );
        const knowledgeCollectionWithAnnotations = [
            ...knowledgeCollection,
            ...knowledgeCollectionAnnotations,
        ];

        await Promise.all([
            this.tripleStoreModuleManager.insertKnowledgeCollectionIntoUnifiedGraph(
                this.repositoryImplementations[toRepository],
                toRepository,
                BASE_NAMED_GRAPHS.HISTORICAL_UNIFIED,
                knowledgeCollectionWithAnnotations,
            ),
            this.tripleStoreModuleManager.deleteUniqueKnowledgeCollectionTriplesFromUnifiedGraph(
                this.repositoryImplementations[toRepository],
                toRepository,
                BASE_NAMED_GRAPHS.UNIFIED,
                ual,
            ),
        ]);
    }

    async construct(repository, query) {
        return this.tripleStoreModuleManager.construct(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async select(repository, query) {
        return this.tripleStoreModuleManager.select(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async queryVoid(repository, query) {
        return this.tripleStoreModuleManager.queryVoid(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }
}

export default TripleStoreService;
