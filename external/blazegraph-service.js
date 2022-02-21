const axios = require('axios');
const qs = require('qs');
const constants = require('../modules/constants');
const SparqlQueryBuilder = require('./sparql/sparql-query-builder');

class BlazegraphService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.sparqlQueryBuilder = new SparqlQueryBuilder();
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
                    this.logger.error(`Failed to write into Blazegraph: ${error} - ${error.stack}`);
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

    async resolve(uri) {
        let isAsset = false;

        const sparqlQuery = this.sparqlQueryBuilder.findNQuadsByGraphUri(uri);
        let nquads = await this.construct(sparqlQuery);

        if (!nquads.length) {
            const sparqlQuery = this.sparqlQueryBuilder.findNQuadsByUAL(uri);
            nquads = await this.construct(sparqlQuery);
            isAsset = true;
        }

        if (nquads.length) {
            nquads = nquads.toString();
            nquads = nquads.replace(/_:genid(.){37}/gm, '_:$1');
            nquads = nquads.split('\n');
            nquads = nquads.filter((x) => x !== '');
        } else {
            nquads = null;
        }
        return { nquads, isAsset };
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
        let result = await this.execute(query);

        return result.results.bindings;
    }

    async findAssertions(nquads) {
        const sparqlQuery = this.sparqlQueryBuilder.findGraphByNQuads(nquads);
        let graph = await this.execute(sparqlQuery);
        graph = graph.results.bindings.map((x) => x.g.value.replace(`${constants.DID_PREFIX}:`, ''));
        if (graph.length && graph[0] === 'http://www.bigdata.com/rdf#nullGraph') {
            return [];
        }
        return graph;
    }

    async findAssertionsByKeyword(keyword, options, localQuery) {
        const sparqlQuery = this.sparqlQueryBuilder.findAssertionIdsByKeyword(keyword, options, localQuery);
        const result = await this.execute(sparqlQuery);
        return result.results.bindings;
    }

    async findAssetsByKeyword(keyword, options, localQuery) {
        const sparqlQuery = this.sparqlQueryBuilder.findAssetsByKeyword(keyword, options, localQuery);                  
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
