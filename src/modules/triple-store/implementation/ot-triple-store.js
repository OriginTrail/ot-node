const Engine = require('@comunica/query-sparql').QueryEngine;
const { DataFactory } = require('rdf-data-factory');
const { setTimeout: sleep } = require('timers/promises');
const N3 = require('n3');
const { fromRdf } = require('rdf-literal');
const { SCHEMA_CONTEXT } = require('../../../constants/constants');
const constants = require('./triple-store-constants');

class OtTripleStore {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        this.initializeSparqlEndpoints(this.config.url, this.config.repository);

        let ready = await this.healthCheck();
        let retries = 0;
        while (!ready && retries < constants.TRIPLE_STORE_CONNECT_MAX_RETRIES) {
            retries += 1;
            this.logger.warn(
                `Cannot connect to Triple store (${this.getName()}), retry number: ${retries}/${
                    constants.TRIPLE_STORE_CONNECT_MAX_RETRIES
                }. Retrying in ${constants.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY} seconds.`,
            );
            await sleep(constants.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY * 1000);
            ready = await this.healthCheck();
        }
        if (retries === constants.TRIPLE_STORE_CONNECT_MAX_RETRIES) {
            this.logger.error(
                `Triple Store (${this.getName()}) not available, max retries reached.`,
            );
            process.exit(1);
        }

        this.queryEngine = new Engine();
        this.filtertype = {
            KEYWORD: 'keyword',
            KEYWORDPREFIX: 'keywordPrefix',
            TYPES: 'types',
            ISSUERS: 'issuers',
        };
        const sources = [
            {
                type: 'sparql',
                value: `${this.sparqlEndpoint}`,
            },
        ];

        this.insertContext = {
            sources,
            destination: {
                type: 'sparql',
                value: `${this.sparqlEndpointUpdate}`,
            },
        };
        this.queryContext = {
            sources,
        };
    }

    initializeSparqlEndpoints(url, repository) {
        // overridden by subclasses
        return true;
    }

    async insertAsset(assertionNquads, assertionId, assetNquads, ual) {
        const insertion = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            DELETE {<${ual}> schema:latestAssertion ?o}
            WHERE {
                GRAPH <assets:graph> {
                    ?s ?p ?o .
                    <${ual}> schema:latestAssertion ?o .
                }
            };
            INSERT DATA {
                GRAPH <assets:graph> { 
                    ${assetNquads} 
                }
                
                GRAPH <assertion:${assertionId}> { 
                    ${assertionNquads} 
                } 
            }`;
        await this.queryEngine.queryVoid(insertion, this.insertContext);
    }

    async insertAssertion(assertionNquads, assertionId) {
        const insertion = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <assertion:${assertionId}> { 
                    ${assertionNquads} 
                } 
            }`;
        await this.queryEngine.queryVoid(insertion, this.insertContext);
    }

    async insertIndex(assertionNquads, assertionId, indexNquads, keyword, assetNquads) {
        const insertion = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <assets:graph> { 
                    ${assetNquads} 
                }
                GRAPH <keyword:${keyword}> {
                    ${indexNquads}
                }
                GRAPH <assertion:${assertionId}> { 
                    ${assertionNquads} 
                } 
            }`;
        await this.queryEngine.queryVoid(insertion, this.insertContext);
    }

    async assertionExists(graphName) {
        const escapedGraphName = this.cleanEscapeCharacter(graphName);
        const query = `ASK WHERE { GRAPH <${escapedGraphName}> { ?s ?p ?o } }`;

        return this.ask(query);
    }

    async searchAssets(keyword, limit, offset) {
        const escapedKeyword = this.cleanEscapeCharacter(keyword);

        const query = `PREFIX schema: <${SCHEMA_CONTEXT}> 
                        SELECT ?ual ?rank ?s ?p ?o
                        WHERE {
                            {
                                SELECT DISTINCT *
                                WHERE {
                                    GRAPH <keyword:${escapedKeyword}> {
                                            ?ual schema:rank ?rank ;
                                                 schema:metadata ?assertion .
                                    }
                                }
                                ORDER BY DESC(?rank)
                                LIMIT ${limit}
                                OFFSET ${offset}
                            }

                            GRAPH ?assertion {
                                ?s ?p ?o .
                            } .
                        }`;

        const bindingsStream = await this.queryEngine.queryBindings(query, this.queryContext);
        const dataFactory = new DataFactory();
        const assetResults = {};

        await new Promise((resolve) => {
            bindingsStream
                .on('data', async (binding) => {
                    const row = {};

                    for (const [key, value] of binding) {
                        row[key.value] = value;
                    }
                    const quad = dataFactory.quad(row.s, row.p, row.o, row.ual);
                    if (!assetResults[row.ual.value]) {
                        assetResults[row.ual.value] = {
                            rank: fromRdf(row.rank),
                            assertion: [quad],
                        };
                    } else {
                        assetResults[row.ual.value].assertion.push(quad);
                    }
                })
                .on('end', () => resolve(assetResults));
        });

        const writer = new N3.Writer({ format: 'N-Triples' });
        for (const ual in assetResults) {
            assetResults[ual].assertion = writer.quadsToString(assetResults[ual].assertion);
        }
        writer.end();

        return assetResults;
    }

    async get(graphName) {
        const escapedGraphName = this.cleanEscapeCharacter(graphName);

        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                    CONSTRUCT { ?s ?p ?o }
                    WHERE {
                        {
                            GRAPH <${escapedGraphName}>
                            {
                                ?s ?p ?o .
                            }
                        }
                    }`;

        return this.construct(query);
    }

    async healthCheck() {
        return true;
    }

    async select(query) {
        const result = await this.queryEngine.query(query, this.queryContext);
        const { data } = await this.queryEngine.resultToString(result);
        let response = '';
        for await (const chunk of data) {
            response += chunk;
        }
        return JSON.parse(response);
    }

    async construct(query) {
        const result = await this.queryEngine.query(query, this.queryContext);
        const { data } = await this.queryEngine.resultToString(
            result,
            'application/n-quads',
            this.queryContext,
        );
        let nquads = '';
        for await (const nquad of data) {
            nquads += nquad;
        }
        return nquads;
    }

    async ask(query) {
        return this.queryEngine.queryBoolean(query, this.queryContext);
    }

    cleanEscapeCharacter(query) {
        return query.replace(/['|[\]\\]/g, '\\$&');
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

module.exports = OtTripleStore;
