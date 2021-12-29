const { ServerClientConfig, GraphDBServerClient } = require('graphdb').server;
const { RepositoryClientConfig, RepositoryConfig, RepositoryType } = require('graphdb').repository;
const { SparqlXmlResultParser } = require('graphdb').parser;
const { GetQueryPayload, QueryType } = require('graphdb').query;
const { RDFMimeType } = require('graphdb').http;
const axios = require('axios');
const {execSync} = require('child_process');
const jsonld = require("jsonld");
const N3 = require("n3");
const { BufferList } = require('bl')

class GraphdbService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.logger = logger;
        this.logger.info(`Data repository name: ${this.config.repositoryName}`);
        const serverConfig = new ServerClientConfig('http://localhost:7200/')
            .setTimeout(10000)
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
                const bl = new BufferList()
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
                const bl = new BufferList()
                stream.on('data', (bindings) => {
                    bl.append(bindings);
                });
                stream.on('end', () => {
                    accept(bl.toString());
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
                const bl = new BufferList()
                stream.on('data', (bindings) => {
                    bl.append(bindings);
                });
                stream.on('end', () => {
                    accept(JSON.parse(bl));
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
            format: 'application/n-quads'
        });

        const framed = await jsonld.frame(copy, frame);

        const compressed = await jsonld.compact(framed, context);
        return compressed;
    }

    async extractMetadata(rdf) {
        return new Promise(async (accept, reject) => {
            const parser = new N3.Parser({ format: 'N-Triples', baseIRI: 'http://schema.org/' });
            const result = {
                metadata: {

                },
                blockchain: {

                },
                assets: [],
                keywords: [],
            };

            parser.parse(
                rdf.join('\n'),
                (error, quad, prefixes) => {
                    if (error)
                        reject(error);
                    if (quad)
                        switch(quad._predicate.id){
                            case "http://schema.org/hasType":
                                result.metadata.type = JSON.parse(quad._object.id);
                                break;
                            case "http://schema.org/hasTimestamp":
                                result.metadata.timestamp = JSON.parse(quad._object.id);
                                break;
                            case "http://schema.org/hasIssuer":
                                result.metadata.issuer = JSON.parse(quad._object.id);
                                break;
                            case "http://schema.org/hasVisibility":
                                result.metadata.visibility = !!quad._object.id.includes('true');
                                break;
                            case "http://schema.org/hasDataHash":
                                result.metadata.dataHash = JSON.parse(quad._object.id);
                                break;
                            case "http://schema.org/hasAsset":
                                result.assets.push(JSON.parse(quad._object.id))
                                break;
                            case "http://schema.org/hasKeyword":
                                result.keywords.push(JSON.parse(quad._object.id))
                                break;
                            case "http://schema.org/hasSignature":
                                result.signature = JSON.parse(quad._object.id);
                                break;
                            case "http://schema.org/hasRootHash":
                                result.rootHash = JSON.parse(quad._object.id);
                                break;
                            case "http://schema.org/hasBlockchain":
                                result.blockchain.name = JSON.parse(quad._object.id);
                                break;
                            case "http://schema.org/hasTransactionHash":
                                result.blockchain.transactionHash = JSON.parse(quad._object.id);
                                break;
                            default:
                                break;
                        }
                    else
                        accept(result);
                });
        });
    }

    async createMetadata(assertion) {
        const result = await this.toRDF({
            '@context': 'https://www.schema.org/',
            hasType: assertion.metadata.type,
            hasSignature: assertion.signature,
            hasIssuer: assertion.metadata.issuer,
            hasTimestamp: assertion.metadata.timestamp,
            hasVisibility: assertion.metadata.visibility,
            hasDataHash: assertion.metadata.dataHash,
        });

        return result.map((x) => x.replace('_:c14n0', `<did:dkg:${assertion.id}>`));
    }


    async createBlockchainMetadata(assertion) {
        const result = await this.toRDF({
            '@context': 'https://www.schema.org/',
            hasBlockchain: assertion.blockchain.name,
            hasTransactionHash: assertion.blockchain.transactionHash,
        });

        return result.map((x) => x.replace('_:c14n0', `<did:dkg:${assertion.id}>`));
    }

    async createConnections(options) {
        const {
            assertionId, assets, keywords, rootHash,
        } = options;

        const result = await this.toRDF({
            '@context': 'https://www.schema.org/',
            hasAsset: assets,
            hasKeyword: keywords,
            hasRootHash: rootHash,
        });

        return result.map((x) => x.replace('_:c14n0', `<did:dkg:${assertionId}>`));
    }

    async resolve(uri) {
        const query = `CONSTRUCT { ?s ?p ?o }
                       WHERE {
                            GRAPH ?g { ?s ?p ?o }
                            FILTER (?g = <did:dkg:${uri}>) .
                       }`;
        let triples = await this.construct(query);
        if (triples) {
            triples = triples.replace(/_:genid(.){37}/gm, '_:$1');
            triples = triples.split('\n');
            triples = triples.filter((x) => x !== '');
        }
        return triples;
    }

    async dataQuery(query) {
        try {
            let data = await this.execute(query);
            data = this.parseTriples(data);
            return data;
        } catch (e) {
            this.logger.error('Bad query submitted');
            return 'Bad query submitted';
        }
    }

    async findAssertions(nquads) {
        const query = `SELECT ?g
                       WHERE {
                            GRAPH ?g { 
                            ${nquads}
                            }
                       }`;
        let g = await this.execute(query);
        return JSON.parse(g).results.bindings.map(x=>x.g.value.replace('did:dkg:',''));
    }

    async isAssertion(uri) {
        const query = `ASK {
                        ?s <http://schema.org/hasDataOntology> ?dataOntology ;
                           <http://schema.org/hasValidationOntology> ?validationOntology ;
                           <http://schema.org/hasIdentityOntology> ?identityOntology ;
                           <http://schema.org/hasAuthorizationOntology> ?authorizationOntology .
                        FILTER (?s = ${uri.indexOf(' ') === -1 ? `<did:dkg:${uri}>` : `"${uri}"`}) .
        }`;
        const result = await this.ask(query);
        return result;
    }

    async getOntologiesByUri(uri) {
        const query = `SELECT ?dataOntology ?validationOntology ?identityOntology ?authorizationOntology
                   WHERE {
                        ?s <http://schema.org/hasDataOntology> ?dataOntology ;
                           <http://schema.org/hasValidationOntology> ?validationOntology ;
                           <http://schema.org/hasIdentityOntology> ?identityOntology ;
                           <http://schema.org/hasAuthorizationOntology> ?authorizationOntology .
                        FILTER (?s = ${uri.indexOf(' ') === -1 ? `<did:dkg:${uri}>` : `"${uri}"`}) .
        }`;
        const ontologies = await this.execute(query);
        if (ontologies && ontologies.length > 0) {
            return {
                dataOntology: JSON.parse(ontologies[0].dataOntology.id),
                validationOntology: JSON.parse(ontologies[0].validationOntology.id),
                identityOntology: JSON.parse(ontologies[0].identityOntology.id),
                authorizationOntology: JSON.parse(ontologies[0].authorizationOntology.id),
            };
        }
    }

    async searchByQuery(query, options, localQuery) {
        const sparqlQuery = `PREFIX schema: <http://schema.org/>
                        SELECT (?outerAssetId AS ?assetId) (GROUP_CONCAT(?assertionId; SEPARATOR=",") AS ?assertions)
                        WHERE {
                            ?assertionId schema:hasAsset ?outerAssetId ;
                            ${!localQuery ? 'schema:hasVisibility true .' : ''}
                            {
                            SELECT distinct ?assertionId
                            WHERE {
                                ?assertionId schema:hasKeyword ?keyword ;
                                             schema:hasIssuer ?issuer ;
                                             schema:hasType ?type .
                                ${options.prefix ? `FILTER contains(lcase(?keyword),'${query.toLowerCase()}')` : `FILTER (lcase(?keyword) = '${query.toLowerCase()}')`}
                                ${options.issuers ? `FILTER (?issuer IN (${JSON.stringify(options.issuers).slice(1, -1)}))` : ''}
                                ${options.types ? `FILTER (?type IN (${JSON.stringify(options.types).slice(1, -1)}))` : ''}
                            }
                            }
                        }
                        group by ?outerAssetId
                        LIMIT ${options.limit}`;
        let result = await this.execute(sparqlQuery);
        result = JSON.parse(result).results.bindings
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
        result = JSON.parse(result).results.bindings
        return result;
    }

    async getDataOntologyForNamedGraph(ng) {
        const query = 'SELECT ?o\n'
            + 'WHERE {\n'
            + '    GRAPH ?g { ?s <http://schema.org/has_data_ontology> ?o} \n'
            + `    FILTER (?g = <${ng}>) .\n`
            + '}';
        let dataOntology = await this.execute(query);
        if (dataOntology[0]) {
            dataOntology = dataOntology[0].o.id.replace(/"/g, '');
        } else {
            dataOntology = null;
        }
        return dataOntology;
    }

    async getGraphsByUri(uri) {
        const query = `SELECT distinct ?g
                       WHERE {
                            ?s ?p ?o  .
                            GRAPH ?g { ?s ?p ?o }
                            FILTER (?s = ${uri.indexOf(' ') === -1 ? `<${uri}>` : `"${uri}"`})  .
                       }`;
        const graphs = await this.execute(query);
        if (graphs && graphs.length > 0) {
            return graphs.map((x) => x.g.id.replace('http://example.com/', ''));
        }

        return undefined;
    }

    async getNamedGraphsByTopic(topic) {
        const query = 'PREFIX schema: <http://schema.org/>\n'
            + '                SELECT distinct ?g\n'
            + '                WHERE {\n'
            + '                     ?s schema:topics ?o  .\n'
            + '                        GRAPH ?g { ?s schema:topics ?o }\n'
            + `    FILTER (?o = '${topic}') .\n`
            + '}';
        const unfromattedNamedGraphs = await this.execute(query);
        const namedGraphs = [];
        for (const ng of unfromattedNamedGraphs) {
            namedGraphs.push(ng.g.id);
        }
        return namedGraphs;
    }

    async getDataByNamedQuery(nq) {
        const query = 'SELECT *\n'
            + 'WHERE {\n'
            + '   ?s ?p ?o\n'
            + '   GRAPH ?g { ?s ?p ?o }\n'
            + `   FILTER (?g = <${nq}>) .\n`
            + '}';
        let data = await this.execute(query);
        data = this.parseTriples(data);
        data.sort();
        return data;
    }

    async getVerifiableCredentialsMetadata(ng) {
        const query = 'SELECT ?s ?p ?o\n'
            + 'WHERE {\n'
            + '    GRAPH ?g {?s ?p ?o}\n'
            + `    FILTER (?g = <${ng}> && ?p = <http://purl.org/dc/terms/created>) .\n`
            + '}';
        let vcMetadata = await this.execute(query);ƒ
        vcMetadata = this.parseTriples(vcMetadata);
        return vcMetadata;
    }

    async healthCheck() {
        try {
            const response = await axios.get('http://localhost:7200/repositories/node0/health', {},
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
            this.logger.error(`GraphDB not available. ${e}`);
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
