const { v1: uuidv1 } = require('uuid');
const N3 = require('n3');
const constants = require('../constants');
const GraphDB = require('../../external/graphdb-service');
const Blazegraph = require('../../external/blazegraph-service');
const axios = require('axios');

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.constants = ctx.constants;
        this.validationService = ctx.validationService;
        this.networkService = ctx.networkService;
        this.nodeService = ctx.nodeService;
        this.workerPool = ctx.workerPool;
        this.blockchainService = ctx.blockchainService;
    }

    getName() {
        return this.implementation.getName();
    }

    async initialize() {
        if (this.config.graphDatabase.implementation === constants.TRIPLE_STORE_IMPLEMENTATION.BLAZEGRAPH) {
            this.implementation = new Blazegraph({
                url: this.config.graphDatabase.url,
            });
        } else {
            this.implementation = new GraphDB({
                repositoryName: this.config.graphDatabase.name,
                username: this.config.graphDatabase.username,
                password: this.config.graphDatabase.password,
                url: this.config.graphDatabase.url,
            });
        }

        let ready = await this.healthCheck();
        let retries = 0;
        while (!ready && retries < constants.TRIPLE_STORE_CONNECT_MAX_RETRIES) {
            retries += 1;
            this.logger.warn(`Cannot connect to Triple store (${this.getName()}), retry number: ${retries}/${constants.TRIPLE_STORE_CONNECT_MAX_RETRIES}. Retrying in ${constants.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY} seconds again.`);
            await new Promise((resolve) => setTimeout(resolve, constants.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY * 1000));
            ready = await this.healthCheck();
        }
        if (retries === constants.TRIPLE_STORE_CONNECT_MAX_RETRIES) {
            this.logger.error({
                msg: `Triple Store (${this.getName()}) not available, max retries reached.`,
                Event_name: constants.ERROR_TYPE.TRIPLE_STORE_UNAVAILABLE_ERROR,
            });
            this.nodeService.stop(1);
        }

        return this.implementation.initialize(this.logger);
    }

    async reinitalize() {
        // TODO: Discussion: add retries - or not
        const ready = await this.healthCheck();
        if (!ready) {
            this.logger.warn(`Cannot connect to Triple store (${this.getName()}), check if your triple store is running.`);
        } else {
            this.implementation.initialize(this.logger);
        }
    }

    async canonize(fileContent, fileExtension) {
        switch (fileExtension) {
            case '.json':
                const assertion = {
                    metadata: {
                        timestamp: new Date().toISOString()
                    },
                    data: await this.workerPool.exec('JSONParse', [fileContent.toString()])
                }
                const nquads = await this.workerPool.exec('toNQuads', [assertion.data])
                if (nquads && nquads.length === 0) {
                    throw new Error(`File format is corrupted, no n-quads extracted.`);
                }

                let type = assertion.data['@type'];
                delete assertion.data['@type'];
                if (!type) {
                    type = 'default';
                }
                assertion.metadata.type = type;
                assertion.data = await this.fromNQuads(nquads, type);

                return {assertion, nquads};
            default:
                throw new Error(`File extension ${fileExtension} is not supported.`);
        }
    }

    async insert(data, assertionId) {
        try {
            return this.implementation.insert(data, assertionId);
        } catch (e) {
            // TODO: Check situation when inserting data recieved from other node
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async resolve(id, localQuery = false, metadataOnly = false) {
        try {
            let {nquads, isAsset} = await this.implementation.resolve(id);
            if (!localQuery && nquads && nquads.find((x) => x.includes(`<${constants.DID_PREFIX}:${id}> <http://schema.org/hasVisibility> "private" .`))) {
                return null;
            }
            if (metadataOnly) {
                nquads = nquads.filter((x) => x.startsWith(`<${constants.DID_PREFIX}:${id}>`));
            }
            return {nquads, isAsset};
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async createAssertion(rawNQuads) {
        const metadata = [];
        const data = [];
        const nquads = [];
        rawNQuads.forEach((nquad)=>{
            if (nquad.startsWith(`<${constants.DID_PREFIX}:`))
                metadata.push(nquad);
            else
                data.push(nquad);

            if (!nquad.includes('hasRootHash') && !nquad.includes('hasBlockchain') && !nquad.includes('hasTransactionHash'))
                nquads.push(nquad);
        });
        const jsonld = await this.extractMetadata(metadata);
        jsonld.data = data;
        return {jsonld, nquads};
    }

    verifyAssertion(assertion, rdf, options = undefined) {
        return new Promise(async (resolve) => {
            try {
                // let dataHash;
                // if (assertion.metadata.visibility) {
                //     const framedData = await this.fromRDF(assertion.data, assertion.metadata.type);
                //     dataHash = this.validationService.calculateHash(framedData);
                // } else {
                //     dataHash = assertion.metadata.dataHash;
                // }
                const {dataHash} = assertion.metadata;

                const metadataHash = this.validationService.calculateHash(assertion.metadata);
                const calculatedAssertionId = this.validationService.calculateHash(metadataHash + dataHash);
                if (assertion.id !== calculatedAssertionId) {
                    this.logger.error({
                        msg: `Assertion Id ${assertion.id} doesn't match with calculated ${calculatedAssertionId}`,
                        Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                        Event_value1: 'Assertion ID not matching calculated',
                    });
                    return resolve(false);
                }

                if (!this.validationService.verify(assertion.id, assertion.signature, assertion.metadata.issuer)) {
                    this.logger.error({
                        msg: 'Signature and issuer don\'t match',
                        Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                        Event_value1: 'Signature and issuer not matching',
                    });
                    return resolve(false);
                }

                if (assertion.metadata.visibility) {
                    if (assertion.metadata.UALs && (!options || (options && options.isAsset))){
                        const {issuer, assertionId} = await this.blockchainService.getAssetProofs(assertion.metadata.UALs[0]);
                        if (assertionId !== assertion.id) {
                            this.logger.error({
                                msg: `Assertion ${assertion.id} doesn't match with calculated ${assertionId}`,
                                Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                                Event_value1: 'AssertionId not matching calculated',
                            });
                            return resolve(false);
                        }
                        if (issuer.toLowerCase() !== assertion.metadata.issuer.toLowerCase()) {
                            this.logger.error({
                                msg: `Issuer ${issuer} doesn't match with received ${assertion.metadata.issuer}`,
                                Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                                Event_value1: 'Issuer not matching',
                            });
                            return resolve(false);
                        }
                    } else{
                        const calculateRootHash = this.validationService.calculateRootHash([...new Set(rdf)]);
                        const {rootHash, issuer} = await this.blockchainService.getAssertionProofs(assertion.id);
                        if (rootHash !== `0x${calculateRootHash}`) {
                            this.logger.error({
                                msg: `Root hash ${rootHash} doesn't match with calculated 0x${calculateRootHash}`,
                                Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                                Event_value1: 'Root hash not matching calculated',
                            });
                            return resolve(false);
                        }
                        if (issuer.toLowerCase() !== assertion.metadata.issuer.toLowerCase()) {
                            this.logger.error({
                                msg: `Issuer ${issuer} doesn't match with received ${assertion.metadata.issuer}`,
                                Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                                Event_value1: 'Issuer not matching',
                            });
                            return resolve(false);
                        }
                    }
                }
                return resolve(true);
            } catch (e) {
                return resolve(false);
            }
        });
    }

    async searchByQuery(query, options, localQuery = false) {
        try {
            const assertions = await this.implementation.findAssetsByKeyword(query, options, localQuery);
            if (!assertions) return null;

            const result = [];
            for (let assertion of assertions) {
                const assertionId = assertion.assertionId = assertion.assertionId.value.replace(`${constants.DID_PREFIX}:`, '');

                assertion = await this.resolve(assertion.assertionId, localQuery, true);
                if (!assertion) continue;


                if (localQuery) {
                    assertion = await this.createAssertion(assertion.nquads);

                    let object = result.find((x) => x.type === assertion.jsonld.metadata.type && x.id === assertion.jsonld.metadata.UALs[0]);
                    if (!object) {
                        object = {
                            id: assertion.jsonld.metadata.UALs[0],
                            type: assertion.jsonld.metadata.type,
                            timestamp: assertion.jsonld.metadata.timestamp,
                            issuers: [],
                            assertions: [],
                            nodes: [this.networkService.getPeerId()],
                        };
                        result.push(object);
                    }

                    if (object.issuers.indexOf(assertion.jsonld.metadata.issuer) === -1) {
                        object.issuers.push(assertion.jsonld.metadata.issuer);
                    }

                    if (object.assertions.indexOf(assertion.jsonld.id) === -1) {
                        object.assertions.push(assertion.jsonld.id);
                    }
                    if (new Date(object.timestamp) < new Date(assertion.jsonld.metadata.timestamp)) {
                        object.timestamp = assertion.jsonld.metadata.timestamp;
                    }
                } else {
                    let object = result.find((x) => x.id === assertionId);
                    if (!object) {
                        object = {
                            assertionId,
                            node: this.networkService.getPeerId(),
                            nquads: assertion.nquads,
                        };
                        result.push(object);
                    }
                }
            }

            return result;
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async searchAssertions(query, options, localQuery = false) {
        try {
            const assertions = await this.implementation.findAssertionsByKeyword(query, options, localQuery);
            if (!assertions) return null;

            const result = [];
            for (let assertion of assertions) {
                const assertionId = assertion.assertionId = assertion.assertionId.value.replace(`${constants.DID_PREFIX}:`, '');

                assertion = await this.resolve(assertion.assertionId, localQuery, true);
                if (!assertion) continue;

                if (localQuery) {
                    assertion = await this.createAssertion(assertion.nquads);
                    let object = result.find((x) => x.id === assertion.id);
                    if (!object) {
                        object = {
                            id: assertion.jsonld.id,
                            metadata: assertion.jsonld.metadata,
                            signature: assertion.jsonld.signature,
                            nodes: [this.networkService.getPeerId()],
                        };
                        result.push(object);
                    }
                } else {
                    let object = result.find((x) => x.id === assertionId);
                    if (!object) {
                        object = {
                            assertionId,
                            node: this.networkService.getPeerId(),
                            nquads: assertion.nquads,
                        };
                        result.push(object);
                    }
                }
            }

            return result;
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async findAssertions(nquads) {
        try {
            let assertions = [];
            for (const nquad of nquads) {
                const result = await this.implementation.findAssertions(nquad);
                assertions = [...new Set(assertions.concat(result))];
            }

            return assertions;
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async runQuery(query, type) {
        const Id_operation = uuidv1();
        let result;
        this.logger.emit({
            msg: 'Started measuring execution of query node',
            Event_name: 'query_node_start',
            Operation_name: 'query_node',
            Id_operation,
        });
        try {
            switch (type) {
                // case 'SELECT':
                //     result = this.implementation.execute(query);
                //     break;
                case 'CONSTRUCT':
                    result = await this.implementation.construct(query);
                    result = result.toString();
                    if (result) {
                        result = result.split('\n').filter((x) => x !== '');
                    } else {
                        result = [];
                    }
                    break;
                // case 'ASK':
                //     result = this.implementation.ask(query);
                //     break;
                default:
                    throw Error('Query type not supported');
            }
            return result;
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        } finally {
            this.logger.emit({
                msg: 'Finished measuring execution of query node',
                Event_name: 'query_node_end',
                Operation_name: 'query_node',
                Id_operation,
            });
        }
    }

    async fromNQuads(nquads, type) {
        const Id_operation = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of fromRDF command',
            Event_name: 'fromrdf_start',
            Operation_name: 'fromrdf',
            Id_operation,
        });
        let context;
        let
            frame;
        switch (type) {
            case this.constants.GS1EPCIS:
                context = {
                    '@context': [
                        'https://gs1.github.io/EPCIS/epcis-context.jsonld',
                        {
                            example: 'http://ns.example.com/epcis/',
                        },
                    ],
                };

                frame = {
                    '@context': [
                        'https://gs1.github.io/EPCIS/epcis-context.jsonld',
                        {
                            example: 'http://ns.example.com/epcis/',
                        },
                    ],
                    isA: 'EPCISDocument',
                };
                break;
            case this.constants.NFT:
                const result = await axios.get(`https://raw.githubusercontent.com/OriginTrail/ot-node/v6/develop/frameDocuments/${this.constants.NFT}.json`);
                context = result.data.context;
                frame = result.data.frame;
                break;
            default:
                context = {
                    '@context': ['https://www.schema.org/'],
                };

                frame = {};
        }
        const json = await this.workerPool.exec('fromNQuads', [nquads, context, frame])

        this.logger.emit({
            msg: 'Finished measuring execution of fromRDF command',
            Event_name: 'fromrdf_end',
            Operation_name: 'fromrdf',
            Id_operation,
        });

        return json;
    }

    healthCheck() {
        return this.implementation.healthCheck();
    }

    restartService() {
        return this.implementation.restartService();
    }

    async appendMetadata(nquads, assertion) {
        const metadata = await this.createMetadata(assertion);
        nquads = nquads.concat(metadata);
        return nquads;
    }

    async createMetadata(assertion) {
        const metadata = {
            '@context': 'https://www.schema.org/',
            '@id': `${constants.DID_PREFIX}:${assertion.id}`,
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

        const result = await this.workerPool.exec('toNQuads', [metadata]);
        return result;
    }

    async appendBlockchainMetadata(nquads, assertion) {
        const blockchainMetadata = await this.workerPool.exec('toNQuads', [{
            '@context': 'https://www.schema.org/',
            '@id': `${constants.DID_PREFIX}:${assertion.id}`,
            hasBlockchain: assertion.blockchain.name,
            hasTransactionHash: assertion.blockchain.transactionHash,
        }]);
        nquads = nquads.concat(blockchainMetadata);
        return nquads;
    }

    async extractMetadata(rdf) {
        return new Promise(async (accept, reject) => {
            const parser = new N3.Parser({ format: 'N-Triples', baseIRI: 'http://schema.org/' });
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
                            result.id = quad._subject.id.replace(`${constants.DID_PREFIX}:`, '');
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
                        Event_name: constants.ERROR_TYPE.EXTRACT_METADATA_ERROR,
                    });
                }
            }

            result.metadata.keywords.sort();
            if (!result.metadata.UALs.length) {
                delete result.metadata.UALs;
            } else {
                result.metadata.UALs.sort();
            }

            accept(result);
        });
    }

    handleUnavailableTripleStoreError(e) {
        if (e.code === 'ECONNREFUSED') {
            this.logger.error({
                msg: `Triple Store (${this.getName()}) not available: ${e.message}. ${e.stack}`,
                Event_name: constants.ERROR_TYPE.TRIPLE_STORE_UNAVAILABLE_ERROR,
                Event_value1: e.message,
            });
            this.reinitalize();
        } else {
            throw e;
        }
    }
}

module.exports = DataService;
