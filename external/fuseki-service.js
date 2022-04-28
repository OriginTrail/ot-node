const axios = require('axios');
const qs = require('qs');
const constants = require('../modules/constants');

class FusekiService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.logger = logger;
        this.config.axios = {
            method: 'post',
            url: `${this.config.url}/${this.config.repositoryName}`,
        };
        this.logger.info('Fuseki module initialized successfully');
    }

    async insert(triples, rootHash) {
        const askQuery = `ASK WHERE { GRAPH <${rootHash}> { ?s ?p ?o } }`;
        const exists = await this.ask(askQuery);
        if (!exists) {
            this.config.axios = {
                method: 'put',
                url: `${this.config.url}/${this.config.repositoryName}/data?graph=${rootHash}`,
                headers: {
                    'Content-Type': 'application/n-quads',
                },
                data: triples,
            };

            await axios(this.config.axios).then(() => true)
                .catch((error) => {
                    this.logger.error({
                        msg: `Failed to write into Fuseki: ${error} - ${error.stack}`,
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
                url: `${this.config.url}/${this.config.repositoryName}/sparql`,
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
                url: `${this.config.url}/${this.config.repositoryName}/sparql`,
                headers: {
                    Accept: 'application/n-quads',
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
                url: `${this.config.url}/${this.config.repositoryName}/sparql`,
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

    async resolve(uri, localQuery, metadataOnly) {
        const graphName = `<${constants.DID_PREFIX}:${uri}>`
        const publicVisibility = localQuery ? '' : `${graphName} schema:hasVisibility "public" .`
        const matchMetadata = metadataOnly ? `${graphName} ?p ?o` : '';
        const previewData = metadataOnly ? `UNION 
        {
            GRAPH ${graphName}
            {
                ?s ?p ?o .
                ${graphName} schema:hasUAI ?s .
                ?s schema:image | schema:url | schema:description | schema:name ?o .
            }
        }` : ''
        
        const query = `PREFIX schema: <http://schema.org/>
                    CONSTRUCT { ?s ?p ?o }
                    WHERE {
                        {
                            GRAPH ${graphName} 
                            {
                                ?s ?p ?o .
                                ${publicVisibility}
                                ${matchMetadata}
                            }
                        }
                        ${previewData}
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
                            SELECT ?assertionId ?assetId
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
            const response = await axios.get(`${this.config.url}/$/ping`, {});
            if (response.data !== null) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    getName() {
        return 'Fuseki';
    }
}

module.exports = FusekiService;
