const Engine = require('@comunica/query-sparql').QueryEngine;
const { setTimeout } = require('timers/promises');
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
            await setTimeout(constants.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY * 1000);
            ready = await this.healthCheck();
        }
        if (retries === constants.TRIPLE_STORE_CONNECT_MAX_RETRIES) {
            this.logger.error({
                msg: `Triple Store (${this.getName()}) not available, max retries reached.`,
                Event_name: constants.ERROR_TYPE.TRIPLE_STORE_UNAVAILABLE_ERROR,
            });
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

    async insert(triples, graphName) {
        const askQuery = `ASK WHERE { GRAPH <${graphName}> { ?s ?p ?o } }`;
        const exists = await this.ask(askQuery);
        if (!exists) {
            const insertion = `
                                  PREFIX schema: <http://schema.org/> 
                                  INSERT DATA
                                  { GRAPH <${graphName}> 
                                    { ${triples} } 
                                  }`;
            await this.queryEngine.queryVoid(insertion, this.insertContext);
            return true;
        }
    }

    async construct(query) {
        const result = await this.executeQuery(query);
        return result;
    }

    async ask(query) {
        const result = await this.queryEngine.queryBoolean(query, this.queryContext);
        return result;
    }

    async assertionExists(graphName) {
        const escapedGraphName = this.cleanEscapeCharacter(graphName);
        const query = `ASK WHERE { GRAPH <${escapedGraphName}> { ?s ?p ?o } }`;

        return await this.ask(query);
    }

    async resolve(graphName) {
        const escapedGraphName = this.cleanEscapeCharacter(graphName);

        const query = `PREFIX schema: <http://schema.org/>
                    CONSTRUCT { ?s ?p ?o }
                    WHERE {
                        {
                            GRAPH <${escapedGraphName}>
                            {
                                ?s ?p ?o .
                            }
                        }
                    }`;
        const nquads = await this.construct(query);
        return nquads;
    }

    async assertionsByAsset(uri) {
        const query = `PREFIX schema: <http://schema.org/>
            SELECT ?assertionId ?issuer ?timestamp
            WHERE {
                 ?assertionId schema:hasUALs "${uri}" ;
                     schema:hasTimestamp ?timestamp ;
                     schema:hasIssuer ?issuer .
            }
            ORDER BY DESC(?timestamp)`;
        const result = await this.execute(query);

        return result;
    }

    async findAssertions(nquads) {
        const query = `SELECT ?g
                       WHERE {
                            GRAPH ?g {
                            ${nquads}
                            }
                       }`;
        let graph = await this.execute(query);
        graph = graph.map((x) => x.g.replace(`${constants.DID_PREFIX}:`, ''));
        if (graph.length && graph[0] === 'http://www.bigdata.com/rdf#nullGraph') {
            return [];
        }
        return graph;
    }

    async findAssertionsByKeyword(query, options, localQuery) {
        if (options.prefix && !this.isBoolean(options.prefix)) {
            this.logger.error(`Failed FindassertionsByKeyword: ${options.prefix} is not a boolean`);
            throw new Error('Prefix is not an boolean');
        }
        if (localQuery && !this.isBoolean(localQuery)) {
            this.logger.error(`Failed FindassertionsByKeyword: ${localQuery} is not a boolean`);
            throw new Error('Localquery is not an boolean');
        }
        let limitQuery = '';
        limitQuery = this.createLimitQuery(options);

        const publicVisibilityQuery = !localQuery
            ? ' ?assertionId schema:hasVisibility "public" .'
            : '';
        const filterQuery = options.prefix
            ? this.createFilterParameter(query, this.filtertype.KEYWORDPREFIX)
            : this.createFilterParameter(query, this.filtertype.KEYWORD);

        const sparqlQuery = `PREFIX schema: <http://schema.org/>
                            SELECT distinct ?assertionId
                            WHERE {
                                ?assertionId schema:hasKeywords ?keyword .
                                ${publicVisibilityQuery}
                                ${filterQuery}
                            }
                        ${limitQuery}`;

        const result = await this.execute(sparqlQuery);
        return result;
    }

    async findAssetsByKeyword(query, options, localQuery) {
        if (options.prefix && !this.isBoolean(options.prefix)) {
            this.logger.error(`Failed FindAssetsByKeyword: ${options.prefix} is not a boolean`);
            //      throw new Error('Prefix is not an boolean');
        }
        if (localQuery && !this.isBoolean(localQuery)) {
            this.logger.error(`Failed FindAssetsByKeyword: ${localQuery} is not a boolean`);
            throw new Error('Localquery is not an boolean');
        }
        const escapedQuery = this.cleanEscapeCharacter(query);
        const limitQuery = this.createLimitQuery(options);

        const publicVisibilityQuery = !localQuery ? 'schema:hasVisibility "public" ;' : '';
        const filterQuery = options.prefix
            ? this.createFilterParameter(escapedQuery, this.filtertype.KEYWORDPREFIX)
            : this.createFilterParameter(escapedQuery, this.filtertype.KEYWORD);
        const issuerFilter = options.issuers
            ? this.createFilterParameter(options.issuers, this.filtertype.ISSUERS)
            : '';
        const typesFilter = options.types
            ? this.createFilterParameter(options.types, this.filtertype.TYPES)
            : '';

        const sparqlQuery = `PREFIX schema: <http://schema.org/>
                            SELECT ?assertionId ?assetId
                            WHERE {
                                ?assertionId schema:hasTimestamp ?latestTimestamp ;
                                 ${publicVisibilityQuery}
                                                     schema:hasUALs ?assetId .
                                    {
                                        SELECT ?assetId (MAX(?timestamp) AS ?latestTimestamp)
                                        WHERE {
                                            ?assertionId schema:hasKeywords ?keyword ;
                                                         schema:hasIssuer ?issuer ;
                                                         schema:hasType ?type ;
                                                         schema:hasTimestamp ?timestamp ;
                                                         schema:hasUALs ?assetId
                                            ${filterQuery}
                                            ${issuerFilter}
                                            ${typesFilter}
                                        }
                                        GROUP BY ?assetId
                                        ${limitQuery}
                                    }
                            }`;
        const result = await this.execute(sparqlQuery);
        return result;
    }

    async healthCheck() {
        return true;
    }

    async executeQuery(query) {
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

    async execute(query) {
        const result = await this.queryEngine.query(query, this.queryContext);
        const { data } = await this.queryEngine.resultToString(result);
        let response = '';
        for await (const chunk of data) {
            response += chunk;
        }
        return JSON.parse(response);
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
