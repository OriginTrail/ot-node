const Engine = require('@comunica/query-sparql').QueryEngine;
const { setTimeout } = require('timers/promises');
const { SCHEMA_CONTEXT } = require('../../../constants/constants');
const constants = require('./triple-store-constants');
const { MEDIA_TYPES } = require('./triple-store-constants');

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
            /* eslint-disable no-await-in-loop */
            await setTimeout(constants.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY * 1000);
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

    initializeSparqlEndpoints() {
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

    async insertAssertion(assertionId, assertionNquads) {
        const exists = await this.assertionExists(assertionId);

        if (!exists) {
            const insertion = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <assertion:${assertionId}> { 
                    ${assertionNquads} 
                } 
            }`;
            await this.queryEngine.queryVoid(insertion, this.insertContext);
        }
    }

    async construct(query) {
        const result = await this._executeQuery(query, MEDIA_TYPES.N_QUADS);
        return result;
    }

    async select(query) {
        // todo: add media type once bug is fixed
        // no media type is passed because of comunica bug
        // https://github.com/comunica/comunica/issues/1034
        const result = await this._executeQuery(query);
        return JSON.parse(result);
    }

    async ask(query) {
        const result = await this.queryEngine.queryBoolean(query, this.queryContext);
        return result;
    }

    async assertionExists(graphName) {
        const escapedGraphName = this.cleanEscapeCharacter(graphName);
        const query = `ASK WHERE { GRAPH <assertion:${escapedGraphName}> { ?s ?p ?o } }`;

        return this.ask(query);
    }

    async get(graphName) {
        const escapedGraphName = this.cleanEscapeCharacter(graphName);

        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                    CONSTRUCT { ?s ?p ?o }
                    WHERE {
                        {
                            GRAPH <assertion:${escapedGraphName}>
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

    async _executeQuery(query, mediaType) {
        const result = await this.queryEngine.query(query, this.queryContext);
        const { data } = await this.queryEngine.resultToString(result, mediaType);

        let response = '';

        for await (const chunk of data) {
            response += chunk;
        }

        return response;
    }

    cleanEscapeCharacter(query) {
        return query.replace(/['|[\]\\]/g, '\\$&');
    }

    createFilterParameter(queryParameter, type) {
        const queryParam = this.cleanEscapeCharacter(queryParameter);

        switch (type) {
            case this.filtertype.KEYWORD:
                return `FILTER (lcase(?keyword) = '${queryParam}')`;
            case this.filtertype.KEYWORDPREFIX:
                return `FILTER contains(lcase(?keyword),'${queryParam}')`;
            case this.filtertype.ISSUERS:
                return `FILTER (?issuer IN (${JSON.stringify(queryParam).slice(1, -1)}))`;
            case this.filtertype.TYPES:
                return `FILTER (?type IN (${JSON.stringify(queryParam).slice(1, -1)}))`;
            default:
                return '';
        }
    }

    createLimitQuery(options) {
        if (!options.limit) {
            return '';
        }
        const queryLimit = Number(options.limit);
        if (Number.isNaN(queryLimit) || !Number.isInteger(queryLimit)) {
            this.logger.error(`Failed creating Limit query: ${options.limit} is not a number`);
            throw new Error('Limit is not a number');
        } else if (Number.isInteger(options.limit) && options.limit < 0) {
            this.logger.error(`Failed creating Limit query: ${options.limit} is negative number`);
            throw new Error('Limit is not a number');
        }
        return `LIMIT ${queryLimit}`;
    }

    isBoolean(param) {
        return typeof param === 'boolean' || ['true', 'false'].includes(param);
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
