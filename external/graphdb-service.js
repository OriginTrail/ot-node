const { ServerClientConfig, GraphDBServerClient } = require('graphdb').server;
const { RepositoryClientConfig, RepositoryConfig, RepositoryType } = require('graphdb').repository;
const { SparqlXmlResultParser } = require('graphdb').parser;
const { GetQueryPayload, QueryType } = require('graphdb').query;
const { RDFMimeType } = require('graphdb').http;
const axios = require('axios');
const { execSync } = require('child_process');
const { BufferList } = require('bl');
const constants = require('../modules/constants');

class GraphdbService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.logger = logger;
        this.logger.info(`Data repository name: ${this.config.repositoryName}`);
        const serverConfig = new ServerClientConfig(this.config.url)
            .setTimeout(40000)
            .setHeaders({
                Accept: RDFMimeType.N_QUADS,
            })
            .setKeepAlive(true);
        this.server = new GraphDBServerClient(serverConfig);

        const exists = await this.server.hasRepository(this.config.repositoryName);
        if (!exists) {
            const newConfig = new RepositoryConfig(this.config.repositoryName, '', new Map(), '', 'Repo title', RepositoryType.FREE);
            // Use the configuration to create new repository
            await this.server.createRepository(newConfig);
        }

        const readTimeout = 30000;
        const writeTimeout = 30000;
        const repositoryServerConfig = new RepositoryClientConfig(this.config.url)
            .setEndpoints([`${this.config.url}/repositories/${this.config.repositoryName}`])
            .setHeaders({
                Accept: RDFMimeType.N_QUADS,
            })
            .setReadTimeout(readTimeout)
            .setWriteTimeout(writeTimeout);

        this.repository = await this.server.getRepository(
            this.config.repositoryName,
            repositoryServerConfig,
        );
        this.repository.registerParser(new SparqlXmlResultParser());
        this.logger.info('GraphDB module initialized successfully');
    }

    async insert(triples, rootHash) {
        const contentType = RDFMimeType.N_QUADS;
        await this.repository.overwrite(triples, contentType, rootHash);
    }

    async execute(query) {
        return new Promise(async (accept, reject) => {
            const payload = new GetQueryPayload()
                .setQuery(query)
                .setQueryType(QueryType.SELECT)
                .setResponseType(RDFMimeType.SPARQL_RESULTS_JSON);

            try {
                const stream = await this.repository.query(payload);
                const bl = new BufferList();
                stream.on('data', (bindings) => {
                    bl.append(bindings);
                });
                stream.on('end', () => {
                    accept(bl);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async construct(query) {
        return new Promise(async (accept, reject) => {
            const payload = new GetQueryPayload()
                .setQuery(query)
                .setQueryType(QueryType.CONSTRUCT)
                .setResponseType(RDFMimeType.N_QUADS);

            try {
                const stream = await this.repository.query(payload);
                const bl = new BufferList();
                stream.on('data', (bindings) => {
                    bl.append(bindings);
                });
                stream.on('end', () => {
                    accept(bl);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async ask(query) {
        return new Promise(async (accept, reject) => {
            const payload = new GetQueryPayload()
                .setQuery(query)
                .setQueryType(QueryType.ASK)
                .setResponseType(RDFMimeType.BOOLEAN_RESULT);
            try {
                const stream = await this.repository.query(payload);
                const bl = new BufferList();
                stream.on('data', (bindings) => {
                    bl.append(bindings);
                });
                stream.on('end', () => {
                    accept(bl);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async resolve(uri) {
        const query = `PREFIX schema: <http://schema.org/>
                        CONSTRUCT { ?s ?p ?o }
                        WHERE {
                          GRAPH <${constants.DID_PREFIX}:${uri}> {
                            ?s ?p ?o
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

        return JSON.parse(result).results.bindings;
    }

    async findAssertions(nquads) {
        const query = `SELECT ?g
                       WHERE {
                            GRAPH ?g {
                            ${nquads}
                            }
                       }`;
        const graph = await this.execute(query);
        return JSON.parse(graph).results.bindings.map((x) => x.g.value.replace(`${constants.DID_PREFIX}:`, ''));
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
        let result = await this.execute(sparqlQuery);
        result = JSON.parse(result).results.bindings;
        return result;
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
        let result = await this.execute(sparqlQuery);
        result = JSON.parse(result).results.bindings;
        return result;
    }

    async healthCheck() {
        try {
            const response = await axios.get(`${this.config.url}/repositories/${this.config.repositoryName}/health`, {},
                {
                    auth: {
                        username: this.config.username,
                        password: this.config.password,
                    },
                });
            if (response.data.status === 'green') {
                return true;
            }
            return false;
        } catch (e) {
            if (e.response && e.response.status === 404) {
                // Expected error: GraphDB is up but has not created node0 repository
                // Ot-node will create repo in initialization
                return true;
            }
            return false;
        }
    }

    async restartService() {
        // TODO: check env if development or production
        const port = execSync('ps -aux | grep graphdb | cut -d\' \' -f7 | head -n 1').toString();
        if (port) {
            execSync(`kill -9 ${port}`);
        }
        execSync('nohup ../graphdb-free-9.9.0/bin/graphdb &');
    }

    getName() {
        return 'GraphDB';
    }
}

module.exports = GraphdbService;
