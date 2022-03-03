const axios = require('axios');
const qs = require('qs');
const constants = require('../modules/constants');

class BlazegraphService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.logger = logger;
        this.config.axios = {
            method: 'post',
            url: `${this.config.url}/sparql`,
        };
        this.logger.info('Blazegraph module initialized successfully');
    }

    async insert(triples, rootHash) {
        const askQuery = `ASK WHERE { GRAPH <${rootHash}> { ?s ?p ?o } }`;
        const exists = await this.ask(askQuery);
        if (!exists) {
            this.config.axios = {
                method: 'post',
                url: `${this.config.url}/sparql?context-uri=${rootHash}`,
                headers: {
                    'Content-Type': 'text/x-nquads',
                },
                data: triples,
            };

            await axios(this.config.axios).then((response) => true)
                .catch((error) => {
                    this.logger.error({
                        msg: `Failed to write into Blazegraph: ${error} - ${error.stack}`,
                        Event_name: constants.ERROR_TYPE.TRIPLE_STORE_INSERT_ERROR,
                    });
                    return false;
                });
        }
        // TODO: else -> Should log if we already have data
    }

    async execute(query) {
        return new Promise(async (accept, reject) => {
            const data = qs.stringify({
                query,
            });
            this.config.axios = {
                method: 'post',
                url: `${this.config.url}/sparql`,
                headers: {
                    Accept: 'application/sparql-results+json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data,
            };
            axios(this.config.axios).then((response) => {
                accept(response.data);
            }).catch((e) => reject(e));
        });
    }

    async construct(query) {
        return new Promise(async (accept, reject) => {
            const data = qs.stringify({
                query,
            });
            this.config.axios = {
                method: 'post',
                url: `${this.config.url}/sparql`,
                headers: {
                    Accept: 'text/x-nquads',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data,
            };
            axios(this.config.axios).then((response) => {
                accept(response.data);
            }).catch((e) => reject(e));
        });
    }

    async ask(query) {
        return new Promise(async (accept, reject) => {
            const data = qs.stringify({
                query,
            });
            this.config.axios = {
                method: 'post',
                url: `${this.config.url}/sparql`,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data,
            };
            axios(this.config.axios).then((response) => {
                accept(response.data.boolean);
            }).catch((e) => reject(e));
        });
    }

    async resolve(uri, onlyMetadata = false) {
        let isAsset = false;
        const query = `PREFIX schema: <http://schema.org/>
        CONSTRUCT { ?s ?p ?o }
        WHERE {
          GRAPH <${constants.DID_PREFIX}:${uri}> {
            ?s ?p ?o
            ${onlyMetadata ? `<${constants.DID_PREFIX}:${uri}> ?p ?o` : '?s ?p ?o'}
          }
        }`;
        let nquads = await this.construct(query);

        if (!nquads.length) {
            const query = `PREFIX schema: <http://schema.org/>
            CONSTRUCT { ?s ?p ?o }
            WHERE {
                GRAPH ?g { 
                    ${onlyMetadata ? `<${constants.DID_PREFIX}:${uri}> ?p ?o` : '?s ?p ?o'}
                }
                {
                    SELECT ?ng
                    WHERE {
                        ?ng schema:hasUALs "${uri}" ;
                            schema:hasTimestamp ?timestamp .
                    }
                    ORDER BY DESC(?timestamp)
                    LIMIT 1
                }
                FILTER (?g = ?ng) .
            }`;
            nquads = await this.construct(query);
            isAsset = true;
        }

        if (nquads.length) {
            nquads = nquads.toString();
            nquads = nquads.split('\n');
            nquads = nquads.filter((x) => x !== '');
            nquads = await this.transformBlankNodes(nquads);
        } else {
            nquads = null;
        }
        return { nquads, isAsset };
    }

    async transformBlankNodes(nquads) {
        // Find minimum blank node value to assign it to _:c14n0
        let minimumBlankNodeValue = -1;
        for (const nquad of nquads) {
            if (nquad.includes('_:t')) {
                const blankNodes = nquad.split(' ').filter((s) => s.includes('_:t'));
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
                const blankNodes = nquad.split(' ').filter((s) => s.includes('_:t'));
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
        const query = `PREFIX schema: <http://schema.org/>
            SELECT ?assertionId ?issuer ?timestamp
            WHERE {
                 ?assertionId schema:hasUALs "${uri}" ;
                     schema:hasTimestamp ?timestamp ;
                     schema:hasIssuer ?issuer .
            }
            ORDER BY DESC(?timestamp)`;
        const result = await this.execute(query);

        return result.results.bindings;
    }

    async findAssertions(nquads) {
        const query = `SELECT ?g
                       WHERE {
                            GRAPH ?g {
                            ${nquads}
                            }
                       }`;
        let graph = await this.execute(query);
        graph = graph.results.bindings.map((x) => x.g.value.replace(`${constants.DID_PREFIX}:`, ''));
        if (graph.length && graph[0] === 'http://www.bigdata.com/rdf#nullGraph') {
            return [];
        }
        return graph;
    }

    async findAssertionsByKeyword(query, options, localQuery) {
        const sparqlQuery = `PREFIX schema: <http://schema.org/>
                            SELECT distinct ?assertionId
                            WHERE {
                                ?assertionId schema:hasKeywords ?keyword .
                                ${!localQuery ? ' ?assertionId schema:hasVisibility "public" .' : ''}
                                ${options.prefix ? `FILTER contains(lcase(?keyword),'${query}')` : `FILTER (lcase(?keyword) = '${query}')`}
                            }
                        ${options.limit ? `LIMIT ${options.limit}` : ''}`;
        const result = await this.execute(sparqlQuery);
        return result.results.bindings;
    }

    async findAssetsByKeyword(query, options, localQuery) {
        const sparqlQuery = `PREFIX schema: <http://schema.org/>
                            SELECT ?assertionId
                            WHERE {
                                ?assertionId schema:hasTimestamp ?latestTimestamp ;
                            ${!localQuery ? 'schema:hasVisibility "public" ;' : ''}
                                                     schema:hasUALs ?assetId .
                                    {
                                        SELECT ?assetId (MAX(?timestamp) AS ?latestTimestamp)
                                        WHERE {
                                            ?assertionId schema:hasKeywords ?keyword ;
                                                         schema:hasIssuer ?issuer ;
                                                         schema:hasType ?type ;
                                                         schema:hasTimestamp ?timestamp ;
                                                         schema:hasUALs ?assetId .
                                ${options.prefix ? `FILTER contains(lcase(?keyword),'${query}')` : `FILTER (lcase(?keyword) = '${query}')`}
                                ${options.issuers ? `FILTER (?issuer IN (${JSON.stringify(options.issuers).slice(1, -1)}))` : ''}
                                ${options.types ? `FILTER (?type IN (${JSON.stringify(options.types).slice(1, -1)}))` : ''}
                                        }
                                        GROUP BY ?assetId
                                        ${options.limit ? `LIMIT ${options.limit}` : ''}
                                    }
                            }`;
        const result = await this.execute(sparqlQuery);
        return result.results.bindings;
    }

    async healthCheck() {
        try {
            const response = await axios.get(`${this.config.url}/status`, {});
            if (response.data !== null) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    getName() {
        return 'Blazegraph';
    }
}

module.exports = BlazegraphService;
