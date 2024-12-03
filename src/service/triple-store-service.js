/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';
import { formatAssertion } from 'assertion-tools';

import {
    SCHEMA_CONTEXT,
    UAL_PREDICATE,
    BASE_NAMED_GRAPHS,
    QUERY_TYPES,
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
        const knowledgeAssetsTriples = this.dataService.groupTriplesBySubject(triples);

        const tripleAnnotations = this.dataService.createTripleAnnotations(
            knowledgeAssetsTriples,
            UAL_PREDICATE,
            knowledgeAssetsUALs.map((ual) => `<${ual}>`),
        );
        const unifiedGraphTriples = [...triples, ...tripleAnnotations];

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
            '@graph': knowledgeAssetsUALs.map((ual, index) => ({
                '@id': ual,
                states: [knowledgeAssetsStatesUALs[index]],
            })),
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

    async construct(repository, query, namedGraphs = null, labels = null) {
        return this.tripleStoreModuleManager.construct(
            this.repositoryImplementations[repository],
            repository,
            this.buildQuery(query, namedGraphs, labels),
        );
    }

    async select(repository, query, namedGraphs = null, labels = null) {
        return this.tripleStoreModuleManager.select(
            this.repositoryImplementations[repository],
            repository,
            this.buildQuery(query, namedGraphs, labels),
        );
    }

    async queryVoid(repository, query, namedGraphs = null, labels = null) {
        return this.tripleStoreModuleManager.queryVoid(
            this.repositoryImplementations[repository],
            repository,
            this.buildQuery(query, namedGraphs, labels),
        );
    }

    getQueryType(query) {
        if (!query || typeof query !== 'string') {
            return null;
        }

        const noComments = query.replace(/#.*$/gm, '').trim();
        const withoutBase = noComments.replace(/BASE\s+<[^>]+>\s*/gi, '').trim();
        const withoutPrefixes = withoutBase.replace(/PREFIX\s+[^\s]+\s+<[^>]+>\s*/gi, '').trim();

        const normalizedQuery = withoutPrefixes.toUpperCase();

        if (normalizedQuery.startsWith('SELECT')) {
            return QUERY_TYPES.SELECT;
        }
        if (normalizedQuery.startsWith('CONSTRUCT')) {
            return QUERY_TYPES.CONSTRUCT;
        }

        return null;
    }

    buildQuery(baseQuery, graphs = [], labels = []) {
        let query = baseQuery.trim();

        const prefixMatches = query.match(/PREFIX\s+[^\s]+\s+<[^>]+>/gi) || [];
        const prefixes = prefixMatches.join('\n');

        const queryWithoutPrefixes = query.replace(/PREFIX\s+[^\s]+\s+<[^>]+>/gi, '').trim();

        const whereMatch = queryWithoutPrefixes.match(/WHERE\s*{([\s\S]*)}/i);
        if (!whereMatch) {
            throw new Error('Base query must contain a WHERE clause.');
        }
        const whereClause = whereMatch[1].trim();

        query = '';
        if (prefixes) {
            query = `${prefixes}\n\n`;
        }

        if (Array.isArray(graphs) && graphs.length > 0) {
            query += 'WHERE {\n';
            graphs.forEach((graph) => {
                query += `  GRAPH <${graph}> {\n    ${whereClause}\n  }\n`;
            });
            query += '}';
        } else {
            query += `WHERE {\n  ${whereClause}\n}`;
        }

        if (Array.isArray(labels) && labels.length > 0) {
            const filters = labels.map((label) => `FILTER(stagod(?????, "${label}"))`).join('\n');
            query += `\n${filters}`;
        }

        return query;
    }
}

export default TripleStoreService;
