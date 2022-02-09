const axios = require('axios');
const jsonld = require('jsonld');
const N3 = require('n3');
const qs = require('qs');
const constants = require('../modules/constants');

class BlazegraphService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.logger = logger;
        this.logger.info('Blazegraph module initialized successfully');
    }

    async insert(triples, rootHash) {
        const askQuery = `ASK WHERE { GRAPH <${rootHash}> { ?s ?p ?o } }`;
        const exists = await this.ask(askQuery);
        if (!exists) {
            const config = {
                method: 'post',
                url: `http://localhost:9999/blazegraph/sparql?context-uri=${rootHash}`,
                headers: {
                    'Content-Type': 'text/x-nquads',
                },
                data: triples,
            };

            await axios(config).then((response) => true)
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
            const config = {
                method: 'post',
                url: 'http://localhost:9999/blazegraph/sparql',
                headers: {
                    Accept: 'application/sparql-results+json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data,
            };
            axios(config).then((response) => {
                accept(response.data);
            }).catch((e) => reject(e));
        });
    }

    async construct(query) {
        return new Promise(async (accept, reject) => {
            const data = qs.stringify({
                query,
            });
            const config = {
                method: 'post',
                url: 'http://localhost:9999/blazegraph/sparql',
                headers: {
                    Accept: 'text/x-nquads',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data,
            };
            axios(config).then((response) => {
                accept(response.data);
            }).catch((e) => reject(e));
        });
    }

    async ask(query) {
        return new Promise(async (accept, reject) => {
            const data = qs.stringify({
                query,
            });
            const config = {
                method: 'post',
                url: 'http://localhost:9999/blazegraph/sparql',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data,
            };
            axios(config).then((response) => {
                accept(response.data.boolean);
            }).catch((e) => reject(e));
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
            const parser = new N3.Parser({ format: 'N-Triples', baseIRI: 'http://schema.org/' });
            const result = {
                metadata: {

                },
                blockchain: {

                },
                assets: [],
                keywords: [],
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
                        break;
                    case 'http://schema.org/hasTimestamp':
                        result.metadata.timestamp = JSON.parse(quad._object.id);
                        break;
                    case 'http://schema.org/hasIssuer':
                        result.metadata.issuer = JSON.parse(quad._object.id);
                        break;
                    case 'http://schema.org/hasVisibility':
                        result.metadata.visibility = !!quad._object.id.includes('true');
                        break;
                    case 'http://schema.org/hasDataHash':
                        result.metadata.dataHash = JSON.parse(quad._object.id);
                        break;
                    case 'http://schema.org/hasAsset':
                        result.assets.push(JSON.parse(quad._object.id));
                        break;
                    case 'http://schema.org/hasKeyword':
                        result.keywords.push(JSON.parse(quad._object.id));
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
                    this.logger.error({ msg: `Error in extracting metadata: ${e}. ${e.stack}`, Event_name: constants.ERROR_TYPE.EXTRACT_METADATA_ERROR });
                }
            }
            accept(result);
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
        triples = triples.toString();
        if (triples) {
            triples = triples.replace(/_:genid(.){37}/gm, '_:$1');
            triples = triples.split('\n');
            triples = triples.filter((x) => x !== '');
        }
        return triples;
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
                        ${options.limit ? `LIMIT ${options.limit}`: ''}`;
        let result = await this.execute(sparqlQuery);
        result = result.results.bindings;
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
        result = result.results.bindings;
        return result;
    }

    async healthCheck() {
        try {
            const response = await axios.get('http://localhost:9999/blazegraph/status', {});
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
