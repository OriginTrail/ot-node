const {ServerClientConfig, GraphDBServerClient} = require('graphdb').server;
const {RepositoryClientConfig, RepositoryConfig, RepositoryType} = require('graphdb').repository;
const {SparqlXmlResultParser} = require('graphdb').parser;
const {GetQueryPayload, QueryType} = require('graphdb').query;
const {RDFMimeType} = require('graphdb').http;
const axios = require('axios');
const {execSync} = require('child_process');
const jsonld = require('jsonld');
const N3 = require('n3');
const {BufferList} = require('bl');
const constants = require('../modules/constants');

class GraphdbService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.logger = logger;
        this.logger.info(`Data repository name: ${this.config.repositoryName}`);
        const serverConfig = new ServerClientConfig('http://localhost:7200/')
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
        const repositoryServerConfig = new RepositoryClientConfig('http://localhost:7200/')
            .setEndpoints([`http://localhost:7200/repositories/${this.config.repositoryName}`])
            .setHeaders({
                Accept: RDFMimeType.N_QUADS,
            })
            .setReadTimeout(readTimeout)
            .setWriteTimeout(writeTimeout);

        this.repository = await this.server.getRepository(this.config.repositoryName, repositoryServerConfig);
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

    async toRDF(jsonContent) {
        let canonized = await jsonld.canonize(jsonContent, {
            algorithm: 'URDNA2015',
            format: 'application/n-quads',
        });

        canonized = canonized.split('\n');
        canonized = canonized.filter((x) => x !== '');

        return canonized;
    }

    async fromRDF(assertion, context, frame) {
        const copy = await jsonld.fromRDF(assertion.join('\n'), {
            algorithm: 'URDNA2015',
            format: 'application/n-quads',
        });

        const framed = await jsonld.frame(copy, frame);

        const compressed = await jsonld.compact(framed, context);
        return compressed;
    }

    async extractMetadata(rdf) {
        return new Promise(async (accept, reject) => {
            const parser = new N3.Parser({format: 'N-Triples', baseIRI: 'http://schema.org/'});
            const result = {
                metadata: {
                    keywords: [],
                    UALs: [],
                },
                blockchain: {},
            };

            const quads = [];
            await parser.parse(
                rdf.join('\n'),
                (error, quad, prefixes) => {
                    if (error) {
                        reject(error);
                    }
                    if (quad) {
                        quads.push(quad);
                    }
                },
            );


            for (const quad of quads) {
                try {
                    switch (quad._predicate.id) {
                        case 'http://schema.org/hasType':
                            result.metadata.type = JSON.parse(quad._object.id);
                            result.id = quad._subject.id.replace('did:dkg:', '');
                            break;
                        case 'http://schema.org/hasTimestamp':
                            result.metadata.timestamp = JSON.parse(quad._object.id);
                            break;
                        case 'http://schema.org/hasUALs':
                            result.metadata.UALs.push(JSON.parse(quad._object.id));
                            break;
                        case 'http://schema.org/hasIssuer':
                            result.metadata.issuer = JSON.parse(quad._object.id);
                            break;
                        case 'http://schema.org/hasVisibility':
                            result.metadata.visibility = JSON.parse(quad._object.id);
                            break;
                        case 'http://schema.org/hasDataHash':
                            result.metadata.dataHash = JSON.parse(quad._object.id);
                            break;
                        case 'http://schema.org/hasKeywords':
                            result.metadata.keywords.push(JSON.parse(quad._object.id));
                            break;
                        case 'http://schema.org/hasSignature':
                            result.signature = JSON.parse(quad._object.id);
                            break;
                        case 'http://schema.org/hasRootHash':
                            result.rootHash = JSON.parse(quad._object.id);
                            break;
                        case 'http://schema.org/hasBlockchain':
                            result.blockchain.name = JSON.parse(quad._object.id);
                            break;
                        case 'http://schema.org/hasTransactionHash':
                            result.blockchain.transactionHash = JSON.parse(quad._object.id);
                            break;
                        default:
                            break;
                    }
                } catch (e) {
                    this.logger.error({
                        msg: `Error in extracting metadata: ${e}. ${e.stack}`,
                        Event_name: constants.ERROR_TYPE.EXTRACT_METADATA_ERROR
                    });
                }
            }

            result.metadata.keywords.sort();
            if (!result.metadata.UALs.length)
                delete result.metadata.UALs;
            else
                result.metadata.UALs.sort();


            accept(result);
        });
    }

    async createMetadata(assertion) {
        const metadata = {
            '@context': 'https://www.schema.org/',
            '@id': `did:dkg:${assertion.id}`,
            hasType: assertion.metadata.type,
            hasSignature: assertion.signature,
            hasIssuer: assertion.metadata.issuer,
            hasTimestamp: assertion.metadata.timestamp,
            hasVisibility: assertion.metadata.visibility,
            hasDataHash: assertion.metadata.dataHash,
            hasKeywords: assertion.metadata.keywords,
        };

        if (assertion.metadata.UALs)
            metadata.hasUALs = assertion.metadata.UALs;

        const result = await this.toRDF(metadata);
        return result;
    }

    async resolve(uri) {
        let isAsset = false;
        const query = `PREFIX schema: <http://schema.org/>
                        CONSTRUCT { ?s ?p ?o }
                        WHERE {
                          GRAPH <did:dkg:${uri}> {
                            ?s ?p ?o
                          }
                        }`;
        let nquads = await this.construct(query);

        if (!nquads.length) {
            const query = `PREFIX schema: <http://schema.org/>
            CONSTRUCT { ?s ?p ?o }
            WHERE {
                GRAPH ?g { ?s ?p ?o }
                {
                    SELECT ?ng
                    WHERE {
                        ?ng schema:hasUALs "${uri}" .
                    }
                    LIMIT 1
                }
                FILTER (?g = ?ng) .
            }`;
            nquads = await this.construct(query);
            isAsset = true;
        }

        if (nquads.length) {
            nquads = nquads.toString();
            nquads = nquads.replace(/_:genid(.){37}/gm, '_:$1');
            nquads = nquads.split('\n');
            nquads = nquads.filter((x) => x !== '');
        } else
            nquads = null;
        return {nquads, isAsset};
    }

    async findAssertions(nquads) {
        const query = `SELECT ?g
                       WHERE {
                            GRAPH ?g { 
                            ${nquads}
                            }
                       }`;
        const g = await this.execute(query);
        return JSON.parse(g).results.bindings.map((x) => x.g.value.replace('did:dkg:', ''));
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
                            SELECT ?assertionId
                            WHERE {
                                ?assertionId schema:hasTimestamp ?timestamp ;
                            ${!localQuery ? 'schema:hasVisibility "public" ;' : ''}
                                                     schema:hasUALs ?assetId .
                                    {
                                        SELECT ?assetId (MAX(?timestamp) AS ?timestamp)
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

    async searchByIds(ids, options) {
        const sparqlQuery = `PREFIX schema: <http://schema.org/>
                            SELECT ?assetId (GROUP_CONCAT(?assertionId; SEPARATOR=",") AS ?assertions)
                            WHERE {
                                ?assertionId schema:hasAsset ?assetId ;
                                             schema:hasIssuer ?issuer ;
                                             schema:hasType ?type .
                                FILTER (?assetId IN (${JSON.stringify(ids).slice(1, -1)}))
                                ${options.issuers ? `FILTER (?issuer IN (${JSON.stringify(options.issuers).slice(1, -1)}))` : ''}
                                ${options.types ? `FILTER (?type IN (${JSON.stringify(options.types).slice(1, -1)}))` : ''}
                            }
                            group by ?assetId
                            LIMIT ${options.limit}`;

        let result = await this.execute(sparqlQuery);
        result = JSON.parse(result).results.bindings;
        return result;
    }

    async healthCheck() {
        try {
            const response = await axios.get(`http://localhost:7200/repositories/${this.config.repositoryName}/health`, {},
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
