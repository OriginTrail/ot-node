const axios = require('axios');
const Engine = require('@comunica/query-sparql').QueryEngine;
const N3 = require('n3');
const constants = require('../modules/constants');

class SparqlqueryService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.logger = logger;
        this.logger.info('Sparql Query module initialized successfully');
        this.queryEngine = new Engine();
        this.filtertype = {
            KEYWORD: 'keyword',
            KEYWORDPREFIX: 'keywordPrefix',
            TYPES: 'types',
            ISSUERS: 'issuers',
        };
        this.context = {
            sources: [{
                type: 'sparql',
                value: `${this.config.url}`,
            }],
            destination: {
                type: 'sparql',
                value: `${this.config.url}`,
            },
            log: this.logger,
        };
    }

    async insert(triples, rootHash) {
        const askQuery = `ASK WHERE { GRAPH <${rootHash}> { ?s ?p ?o } }`;
        const exists = await this.ask(askQuery);
        const insertion = `
                                  PREFIX schema: <http://schema.org/> 
                                  INSERT DATA
                                  { GRAPH <${rootHash}> 
                                  { ${triples}  
                                  } 
                                  }`;
        if (!exists) {
            await this.queryEngine.queryVoid(insertion, this.context);
            return true;
        }
    }

    async construct(query) {
        const result = await this.executeQuery(query);
        return result;
    }

    async ask(query) {
        const result = await this.queryEngine.queryBoolean(query, this.context);
        return result;
    }

    async resolve(uri) {
        const query = `PREFIX schema: <http://schema.org/>
                        CONSTRUCT { ?s ?p ?o }
                        WHERE {
                          GRAPH <${constants.DID_PREFIX}:${uri}> {
                            ?s ?p ?o
                          }
                        }`;

        let nquads = await this.construct(query);

        const writer = new N3.Writer();
        writer.addQuads(nquads);
        writer.end(async (error, result) => {
            if (nquads.length) {
                nquads = result;
                nquads = nquads.split('\n');
                nquads = nquads.filter((x) => x !== '');
                nquads = await this.transformBlankNodes(nquads);
            } else {
                nquads = null;
            }
            return nquads;
        });
    }

    async transformBlankNodes(nquads) {
        // Find minimum blank node value to assign it to _:c14n0
        let minimumBlankNodeValue = -1;
        for (const nquad of nquads) {
            if (nquad.includes('_:t')) {
                const blankNodes = nquad.split(' ')
                    .filter((s) => s.includes('_:t'));
                for (const bn of blankNodes) {
                    const bnValue = Number(bn.substring(3));
                    if (minimumBlankNodeValue === -1 || minimumBlankNodeValue > bnValue) {
                        minimumBlankNodeValue = bnValue;
                    }
                }
            }
        }

        // Transform blank nodes, example: _:t145 -> _:c14n3
        let bnName;
        for (const nquadIndex in nquads) {
            const nquad = nquads[nquadIndex];
            if (nquad.includes('_:t')) {
                const blankNodes = nquad.split(' ')
                    .filter((s) => s.includes('_:t'));
                for (const bn of blankNodes) {
                    const bnValue = Number(bn.substring(3));
                    bnName = `_:c14n${bnValue - minimumBlankNodeValue}`;
                    nquads[nquadIndex] = nquads[nquadIndex].replace(bn, bnName);
                }
            }
        }

        return nquads;
    }

    async assertionsByAsset(uri) {
        this.logger.info('dummy for ESLint');
    }

    async findAssertions(nquads) {
        this.logger.info('dummy for ESLint');
    }

    async findAssertionsByKeyword(query, options, localQuery) {
        if (options.prefix && !(typeof options.prefix === 'boolean')) {
            this.logger.error(`Failed FindassertionsByKeyword: ${options.prefix} is not a boolean`);
            throw new Error('Prefix is not an boolean');
        }
        if (localQuery && !(typeof localQuery === 'boolean')) {
            this.logger.error(`Failed FindassertionsByKeyword: ${localQuery} is not a boolean`);
            throw new Error('Localquery is not an boolean');
        }
        let limitQuery = '';
        limitQuery = this.createLimitQuery(options);

        const publicVisibilityQuery = !localQuery ? ' ?assertionId schema:hasVisibility "public" .' : '';
        const filterQuery = options.prefix ? this.createFilterParameter(query, this.filtertype.KEYWORDPREFIX) : this.createFilterParameter(query, this.filtertype.KEYWORD);

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
        if (options.prefix && !(typeof options.prefix === 'boolean')) {
            this.logger.error(`Failed FindAssetsByKeyword: ${options.prefix} is not a boolean`);
            //      throw new Error('Prefix is not an boolean');
        }
        if (localQuery && !(typeof localQuery === 'boolean')) {
            this.logger.error(`Failed FindAssetsByKeyword: ${localQuery} is not a boolean`);
            throw new Error('Localquery is not an boolean');
        }
        query = this.cleanEscapeCharacter(query);
        const limitQuery = this.createLimitQuery(options);

        const publicVisibilityQuery = !localQuery ? 'schema:hasVisibility "public" :' : '';
        const filterQuery = options.prefix ? this.createFilterParameter(query, this.filtertype.KEYWORDPREFIX) : this.createFilterParameter(query, this.filtertype.KEYWORD);
        const issuerFilter = options.issuers ? this.createFilterParameter(options.issuers, this.filtertype.ISSUERS) : '';
        const typesFilter = options.types ? this.createFilterParameter(options.types, this.filtertype.TYPES) : '';

        const sparqlQuery = `PREFIX schema: <http://schema.org/>
                            SELECT ?assertionId
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
                                                         schema:hasUALs ?assetId .
                                ${filterQuery}
                                ${issuerFilter}
                                ${typesFilter}
                                        }
                                        GROUP BY ?assetId
                                        ${limitQuery}
                                    }
                            }`;
        const result = await this.execute(sparqlQuery);
        return result.map((value) => value.get('assertionId'));
    }

    async healthCheck() {
        try {
            const response = await axios.head(`${this.config.url}`, {});
            return response.data !== null;
        } catch (e) {
            return false;
        }
    }

    async executeQuery(query) {
        const test = await this.queryEngine.queryQuads(query, this.context);
        return test.toArray();
    }

    async execute(query) {
        const test = await this.queryEngine.queryBindings(query, this.context);
        return test.toArray();
    }

    cleanEscapeCharacter(query) {
        return query.replace(/['|[\]\\]/g, '\\$&');
    }

    createFilterParameter(queryParameter, type) {
        queryParameter = this.cleanEscapeCharacter(queryParameter);

        switch (type) {
        case this.filtertype.KEYWORD:
            return `FILTER (lcase(?keyword) = '${queryParameter}')`;
        case this.filtertype.KEYWORDPREFIX:
            return `FILTER contains(lcase(?keyword),'${queryParameter}')`;
        case this.filtertype.ISSUERS:
            return `FILTER (?issuer IN (${JSON.stringify(queryParameter)
                .slice(1, -1)}))`;
        case this.filtertype.TYPES:
            return `FILTER (?type IN (${JSON.stringify(queryParameter)
                .slice(1, -1)}))`;
        default:
            return '';
        }
    }

    createLimitQuery(options) {
        if (options.limit && !Number.isInteger(options.limit)) {
            this.logger.error(`Failed creating Limit query: ${options.limit} is not a number`);
            throw new Error('Limit is not a number');
        } else if (Number.isInteger(options.limit) && options.limit < 0) {
            this.logger.error(`Failed creating Limit query: ${options.limit} is negative number`);
            throw new Error('Limit is not a number');
        }
        return options.limit ? `LIMIT ${options.limit}` : '';
    }
}

module.exports = SparqlqueryService;
