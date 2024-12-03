import { QueryEngine as Engine } from '@comunica/query-sparql';
import { setTimeout } from 'timers/promises';
import {
    SCHEMA_CONTEXT,
    TRIPLE_STORE_CONNECT_MAX_RETRIES,
    TRIPLE_STORE_CONNECT_RETRY_FREQUENCY,
    MEDIA_TYPES,
    UAL_PREDICATE,
    BASE_NAMED_GRAPHS,
    TRIPLE_ANNOTATION_LABEL_PREDICATE,
} from '../../../constants/constants.js';

class OtTripleStore {
    async initialize(config, logger) {
        this.logger = logger;
        this.repositories = config.repositories;
        this.initializeRepositories();
        this.initializeContexts();
        await this.ensureConnections();
        this.queryEngine = new Engine();
    }

    initializeRepositories() {
        for (const repository of Object.keys(this.repositories)) {
            this.initializeSparqlEndpoints(repository);
        }
    }

    async initializeParanetRepository(repository) {
        const publicCurrent = 'publicCurrent';
        this.repositories[repository] = {
            url: this.repositories[publicCurrent].url,
            name: repository,
            username: this.repositories[publicCurrent].username,
            password: this.repositories[publicCurrent].password,
        };
        this.initializeSparqlEndpoints(repository);
        this.initializeContexts();
        await this.ensureConnections();
        await this.createRepository(repository);
    }

    async createRepository() {
        throw Error('CreateRepository not implemented');
    }

    initializeSparqlEndpoints() {
        throw Error('initializeSparqlEndpoints not implemented');
    }

    async deleteRepository() {
        throw Error('deleteRepository not implemented');
    }

    initializeContexts() {
        for (const repository in this.repositories) {
            const sources = [
                {
                    type: 'sparql',
                    value: this.repositories[repository].sparqlEndpoint,
                },
            ];

            this.repositories[repository].updateContext = {
                sources,
                destination: {
                    type: 'sparql',
                    value: this.repositories[repository].sparqlEndpointUpdate,
                },
            };
            this.repositories[repository].queryContext = {
                sources,
            };
        }
    }

    async ensureConnections() {
        const ensureConnectionPromises = Object.keys(this.repositories).map(async (repository) => {
            let ready = await this.healthCheck(repository);
            let retries = 0;
            while (!ready && retries < TRIPLE_STORE_CONNECT_MAX_RETRIES) {
                retries += 1;
                this.logger.warn(
                    `Cannot connect to Triple store (${this.getName()}), repository: ${repository}, located at: ${
                        this.repositories[repository].url
                    }  retry number: ${retries}/${TRIPLE_STORE_CONNECT_MAX_RETRIES}. Retrying in ${TRIPLE_STORE_CONNECT_RETRY_FREQUENCY} seconds.`,
                );
                /* eslint-disable no-await-in-loop */
                await setTimeout(TRIPLE_STORE_CONNECT_RETRY_FREQUENCY * 1000);
                ready = await this.healthCheck(repository);
            }
            if (retries === TRIPLE_STORE_CONNECT_MAX_RETRIES) {
                this.logger.error(
                    `Triple Store (${this.getName()})  not available, max retries reached.`,
                );
                process.exit(1);
            }
        });

        await Promise.all(ensureConnectionPromises);
    }

    async insertKnowledgeCollectionIntoUnifiedGraph(repository, namedGraph, collectionNQuads) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <${namedGraph}> { 
                    ${collectionNQuads.join('\n')}
                } 
            }
        `;

        await this.queryVoid(repository, query);
    }

    async deleteUniqueKnowledgeCollectionTriplesFromUnifiedGraph(repository, namedGraph, ual) {
        const query = `
            DELETE {
                GRAPH <${namedGraph}> {
                    ?s ?p ?o .
                    << ?s ?p ?o >> ?annotationPredicate ?annotationValue .
                }
            }
            WHERE {
                GRAPH <${namedGraph}> {
                    << ?s ?p ?o >> ${UAL_PREDICATE} ?annotationValue .
                }
                FILTER(STRSTARTS(STR(?annotationValue), "${ual}/"))

                {
                    SELECT ?s ?p ?o (COUNT(?annotationValue) AS ?annotationCount)
                    WHERE {
                        GRAPH <${namedGraph}> {
                            << ?s ?p ?o >> ${UAL_PREDICATE} ?annotationValue .
                        }
                    }
                    GROUP BY ?s ?p ?o
                    HAVING(?annotationCount = 1)
                }
            }
        `;

        await this.queryVoid(repository, query);
    }

    async getKnowledgeCollectionFromUnifiedGraph(repository, namedGraph, ual, sort) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            CONSTRUCT { ?s ?p ?o . }
            WHERE {
                GRAPH <${namedGraph}> {
                    << ?s ?p ?o >> ${UAL_PREDICATE} ?ual .
                    FILTER(STRSTARTS(STR(?ual), "${ual}/"))
                }
            }
            ${sort ? 'ORDER BY ?s' : ''}
        `;

        return this.construct(repository, query);
    }

    async getKnowledgeCollectionPublicFromUnifiedGraph(repository, namedGraph, ual, sort) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            CONSTRUCT { ?s ?p ?o }
            WHERE {
                GRAPH <${namedGraph}> {
                    << ?s ?p ?o >> ${UAL_PREDICATE} ?ual .
                    FILTER(STRSTARTS(STR(?ual), "${ual}/"))
                    FILTER NOT EXISTS {
                        << ?s ?p ?o >> ${TRIPLE_ANNOTATION_LABEL_PREDICATE} "private" .
                    }
                }
            }
            ${sort ? 'ORDER BY ?s' : ''}
        `;

        return this.construct(repository, query);
    }

    async knowledgeCollectionExistsInUnifiedGraph(repository, namedGraph, ual) {
        const query = `
            ASK
            WHERE {
                GRAPH <${namedGraph}> {
                    << ?s ?p ?o >> ${UAL_PREDICATE} <${ual}>
                }
            }
        `;

        return this.ask(repository, query);
    }

    async deleteUniqueKnowledgeAssetTriplesFromUnifiedGraph(repository, namedGraph, ual) {
        const query = `
            DELETE {
                GRAPH <${namedGraph}> {
                    ?s ?p ?o .
                    << ?s ?p ?o >> ?annotationPredicate ?annotationValue .
                }
            }
            WHERE {
                GRAPH <${namedGraph}> {
                    << ?s ?p ?o >> ${UAL_PREDICATE} <${ual}> .
                }

                {
                    SELECT ?s ?p ?o (COUNT(?annotationValue) AS ?annotationCount)
                    WHERE {
                        GRAPH <${namedGraph}> {
                            << ?s ?p ?o >> ${UAL_PREDICATE} ?annotationValue .
                        }
                    }
                    GROUP BY ?s ?p ?o
                    HAVING(?annotationCount = 1)
                }
            }
        `;

        await this.queryVoid(repository, query);
    }

    async getKnowledgeAssetFromUnifiedGraph(repository, namedGraph, ual) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            CONSTRUCT { ?s ?p ?o . }
            WHERE {
                GRAPH <${namedGraph}> {
                    << ?s ?p ?o >> ${UAL_PREDICATE} <${ual}> .
                }
            }
        `;

        return this.construct(repository, query);
    }

    async getKnowledgeAssetPublicFromUnifiedGraph(repository, namedGraph, ual) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            CONSTRUCT { ?s ?p ?o . }
            WHERE {
                GRAPH <${namedGraph}> {
                    << ?s ?p ?o >> ${UAL_PREDICATE} <${ual}> .
                    FILTER NOT EXISTS {
                        << ?s ?p ?o >> ${TRIPLE_ANNOTATION_LABEL_PREDICATE} "private" .
                    }
                }
            }
        `;

        return this.construct(repository, query);
    }

    async knowledgeAssetExistsInUnifiedGraph(repository, namedGraph, ual) {
        const query = `
            ASK
            WHERE {
                GRAPH <${namedGraph}> {
                    << ?s ?p ?o >> ${UAL_PREDICATE} <${ual}>
                }
            }
        `;

        return this.ask(repository, query);
    }

    async createKnowledgeCollectionNamedGraphs(repository, uals, assetsNQuads) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                ${uals
                    .map(
                        (ual, index) => `
                    GRAPH <${ual}> {
                        ${assetsNQuads[index].join('\n')}
                    }
                `,
                    )
                    .join('\n')}
            }
        `;

        await this.queryVoid(repository, query);
    }

    async deleteKnowledgeCollectionNamedGraphs(repository, uals) {
        const query = `${uals.map((ual) => `DROP GRAPH <${ual}>`).join(';\n')};`;

        await this.queryVoid(repository, query);
    }

    async getKnowledgeCollectionNamedGraphs(repository, ual, sort) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            CONSTRUCT { ?s ?p ?o . }
            WHERE {
                GRAPH ?g {
                    ?s ?p ?o .
                }
                FILTER(STRSTARTS(STR(?g), "${ual}/"))
            }
            ${sort ? 'ORDER BY ?s' : ''}
        `;

        return this.construct(repository, query);
    }

    async getKnowledgeCollectionNamedGraphsPublic(repository, ual, sort) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            CONSTRUCT { ?s ?p ?o . }
            WHERE {
                GRAPH ?g {
                    ?s ?p ?o .
                    FILTER NOT EXISTS {
                        << ?s ?p ?o >> ${TRIPLE_ANNOTATION_LABEL_PREDICATE} "private" .
                    }
                }
                FILTER(STRSTARTS(STR(?g), "${ual}/"))
            }
            ${sort ? 'ORDER BY ?s' : ''}
        `;

        return this.construct(repository, query);
    }

    async knowledgeCollectionNamedGraphsExist(repository, ual) {
        const query = `
            ASK {
                GRAPH ?g {
                    ?s ?p ?o
                }
                FILTER(STRSTARTS(STR(?g), "${ual}/"))
            }
        `;

        return this.ask(repository, query);
    }

    async deleteKnowledgeAssetNamedGraph(repository, ual) {
        const query = `
            DROP GRAPH <${ual}>
        `;

        await this.queryVoid(repository, query);
    }

    async getKnowledgeAssetNamedGraph(repository, ual) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            CONSTRUCT  { ?s ?p ?o } 
            WHERE {
                GRAPH <${ual}> {
                    ?s ?p ?o .
                }
            }
        `;

        return this.construct(repository, query);
    }

    async getKnowledgeAssetNamedGraphPublic(repository, ual) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            CONSTRUCT  { ?s ?p ?o } 
            WHERE {
                GRAPH <${ual}> {
                    ?s ?p ?o .
                    FILTER NOT EXISTS {
                        << ?s ?p ?o >> ${TRIPLE_ANNOTATION_LABEL_PREDICATE} "private" .
                    }
                }
            }
        `;

        return this.construct(repository, query);
    }

    async knowledgeAssetNamedGraphExists(repository, ual) {
        const query = `
            ASK {
                GRAPH <${ual}> {
                    ?s ?p ?o
                }
            }
        `;

        return this.ask(repository, query);
    }

    async insertKnowledgeCollectionMetadata(repository, metadataNQuads) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <${BASE_NAMED_GRAPHS.METADATA}> { 
                    ${metadataNQuads} 
                } 
            }
        `;

        await this.queryVoid(repository, query);
    }

    async deleteKnowledgeCollectionMetadata(repository, ual) {
        const query = `
            DELETE
            WHERE {
                GRAPH <${BASE_NAMED_GRAPHS.METADATA}> {
                    ?ual ?p ?o .
                    FILTER(STRSTARTS(STR(?ual), "${ual}/"))
                }
            }
        `;

        await this.queryVoid(repository, query);
    }

    async getKnowledgeCollectionMetadata(repository, ual) {
        const query = `
            CONSTRUCT { ?ual ?p ?o . }
            WHERE {
                GRAPH <${BASE_NAMED_GRAPHS.METADATA}> {
                    ?ual ?p ?o .
                    FILTER(STRSTARTS(STR(?ual), "${ual}/"))
                }
            }
        `;

        return this.construct(repository, query);
    }

    async getKnowledgeAssetMetadata(repository, ual) {
        const query = `
            CONSTRUCT { <${ual}> ?p ?o . }
            WHERE {
                GRAPH <${BASE_NAMED_GRAPHS.METADATA}> {
                    <${ual}> ?p ?o .
                }
            }
        `;

        return this.construct(repository, query);
    }

    async knowledgeCollectionMetadataExists(repository, ual) {
        const query = `
            ASK {
                GRAPH <${BASE_NAMED_GRAPHS.METADATA}> {
                    ?ual ?p ?o
                    FILTER(STRSTARTS(STR(?ual), "${ual}/"))
                }
            }
        `;

        return this.ask(repository, query);
    }

    async construct(repository, query) {
        return this._executeQuery(repository, query, MEDIA_TYPES.N_QUADS);
    }

    async select(repository, query) {
        // todo: add media type once bug is fixed
        // no media type is passed because of comunica bug
        // https://github.com/comunica/comunica/issues/1034
        const result = await this._executeQuery(repository, query);
        return result ? JSON.parse(result) : [];
    }

    async queryVoid(repository, query) {
        return this.queryEngine.queryVoid(query, this.repositories[repository].updateContext);
    }

    async ask(repository, query) {
        return this.queryEngine.queryBoolean(query, this.repositories[repository].queryContext);
    }

    async healthCheck() {
        return true;
    }

    async _executeQuery(repository, query, mediaType) {
        const result = await this.queryEngine.query(
            query,
            this.repositories[repository].queryContext,
        );
        const { data } = await this.queryEngine.resultToString(result, mediaType);

        let response = '';

        for await (const chunk of data) {
            response += chunk;
        }

        return response;
    }

    async reinitialize() {
        const ready = await this.healthCheck();
        if (!ready) {
            this.logger.warn(
                `Cannot connect to Triple store (${this.getName()}), check if your triple store is running.`,
            );
        } else {
            this.implementation.initialize(this.logger);
        }
    }
}

export default OtTripleStore;
