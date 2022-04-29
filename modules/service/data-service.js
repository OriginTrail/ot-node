const { v1: uuidv1 } = require('uuid');
const N3 = require('n3');
const toobusy = require('toobusy-js');
const constants = require('../constants');
const GraphDB = require('../../external/graphdb-service');
const Blazegraph = require('../../external/blazegraph-service');
const Fuseki = require('../../external/fuseki-service');

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
        this.tripleStoreQueue = ctx.tripleStoreQueue.promise(
            this,
            this.handleTripleStoreRequest,
            1,
        );
        this.N3Parser = new N3.Parser({ format: 'N-Triples', baseIRI: 'http://schema.org/' });
    }

    getTripleStoreQueueLength() {
        return this.tripleStoreQueue.length();
    }

    getName() {
        return this.implementation.getName();
    }

    async initialize() {
        if (
            this.config.graphDatabase.implementation
            === constants.TRIPLE_STORE_IMPLEMENTATION.BLAZEGRAPH
        ) {
            this.implementation = new Blazegraph({
                url: this.config.graphDatabase.url,
            });
        } else if(
            this.config.graphDatabase.implementation
            === constants.TRIPLE_STORE_IMPLEMENTATION.GRAPHDB
        ) {
            this.implementation = new GraphDB({
                repositoryName: this.config.graphDatabase.name,
                username: this.config.graphDatabase.username,
                password: this.config.graphDatabase.password,
                url: this.config.graphDatabase.url,
            });
        } else {
            this.implementation = new Fuseki({
                repositoryName: this.config.graphDatabase.name,
                url: this.config.graphDatabase.url,
            });
        }

        let ready = await this.healthCheck();
        let retries = 0;
        while (!ready && retries < constants.TRIPLE_STORE_CONNECT_MAX_RETRIES) {
            retries += 1;
            this.logger.warn(`Cannot connect to Triple store (${this.getName()}), retry number: ${retries}/${constants.TRIPLE_STORE_CONNECT_MAX_RETRIES}. Retrying in ${constants.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY} seconds again.`);
            await new Promise(
                (resolve) => setTimeout(
                    resolve,
                    constants.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY * 1000,
                ),
            );
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

    async canonize(fileContent, fileExtension, method) {
        switch (fileExtension) {
        case '.json':
            const assertion = {
                metadata: {
                    timestamp: new Date().toISOString(),
                },
                data: await this.workerPool.exec('JSONParse', [fileContent.toString()]),
            };
            if (method !== constants.SERVICE_API_ROUTES.PUBLISH || method !== constants.SERVICE_API_ROUTES.UPDATE) {
                if (assertion.data['@id'] && !Number.isNaN(parseInt(assertion.data['@id'], 10))) {
                    assertion.metadata.UAL = `dkg://did.${this.config.blockchain[0].networkId.split(':').join('.')}.${this.config.blockchain[0].hubContractAddress}/${parseInt(assertion.data['@id'],10)}`;
                } else {
                    assertion.metadata.UAL = `dkg://did.${this.config.blockchain[0].networkId.split(':').join('.')}.${this.config.blockchain[0].hubContractAddress}/${Math.floor(Math.random() * 10000)}`;
                }
                assertion.data['@id'] = assertion.metadata.UAL;
            }else {
                delete assertion.data['@id'];
            }

            const nquads = await this.workerPool.exec('toNQuads', [assertion.data, '']);
            if (nquads && nquads.length === 0) {
                throw new Error('File format is corrupted, no n-quads extracted.');
            }

            let type;
            if (assertion.data['@type']) {
                type = assertion.data['@type'];
                delete assertion.data['@type'];
            } else if (assertion.data.type) {
                type = assertion.data.type;
                delete assertion.data.type;
            } else {
                type = 'default';
            }
            assertion.metadata.type = type;
            assertion.data = await this.fromNQuads(nquads, type);
            assertion.data['@id'] = assertion.data.id;
            delete assertion.data.id;
            return { assertion, nquads };
        default:
            throw new Error(`File extension ${fileExtension} is not supported.`);
        }
    }

    async insert(data, assertionId) {
        try {
            const result = await this.tripleStoreQueue.push({ operation: 'insert', data, assertionId });
            return result;
        } catch (e) {
            // TODO: Check situation when inserting data recieved from other node
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async resolve(id, localQuery = false, metadataOnly = false) {
        try {
            let nquads = await this.tripleStoreQueue.push({ operation: 'resolve', id, localQuery, metadataOnly});
            if (nquads.length) {
                nquads = nquads.toString();
                nquads = nquads.split('\n');
                nquads = nquads.filter((x) => x !== '');
                // canonize nquads before roothash validation
                nquads = await this.workerPool.exec('toNQuads', [nquads.join('\n'), 'application/n-quads']);
            } else {
                nquads = null;
            }

            return nquads;
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async assertionsByAsset(id) {
        try {
            const assertions = await this.tripleStoreQueue.push({ operation: 'assertionsByAsset', id });

            return assertions.map((x) => ({
                id: x.assertionId.value.slice(8),
                issuer: x.issuer.value,
                timestamp: x.timestamp.value,
            }));
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async createAssertion(rawNQuads, previewDataOnly) {
        const metadata = [];
        const data = [];
        const nquads = [];
        rawNQuads.forEach((nquad) => {
            if (nquad.startsWith(`<${constants.DID_PREFIX}:`)) {
                metadata.push(nquad);
            } else {
                data.push(nquad);
            }
            if (!nquad.includes('hasRootHash') && !nquad.includes('hasBlockchain') && !nquad.includes('hasTransactionHash')) {
                nquads.push(nquad);
            }
        });
        const jsonld = await this.extractMetadata(metadata);
        if(previewDataOnly) {
            jsonld.previewData = await this.extractPreviewData(data, jsonld.metadata.UAL);
        }
        jsonld.data = data;
        return { jsonld, nquads };
    }

    verifyAssertion(assertion, rdf, options = undefined) {
        return new Promise(async (resolve) => {
            try {
                // let dataHash;
                // if (assertion.metadata.visibility) {
                //   const framedData = await this.fromRDF(assertion.data, assertion.metadata.type);
                //     dataHash = this.validationService.calculateHash(framedData);
                // } else {
                //     dataHash = assertion.metadata.dataHash;
                // }
                const { dataHash } = assertion.metadata;

                const metadataHash = this.validationService.calculateHash(assertion.metadata);
                const calculatedAssertionId = this.validationService.calculateHash(
                    metadataHash + dataHash,
                );
                // if (assertion.id !== calculatedAssertionId) {
                //     this.logger.error({
                //         msg: `Assertion Id ${assertion.id} doesn't match with calculated ${calculatedAssertionId}`,
                //         Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                //         Event_value1: 'Assertion ID not matching calculated',
                //     });
                //     return resolve(false);
                // }

                if (!this.validationService.verify(
                    assertion.id,
                    assertion.signature,
                    assertion.metadata.issuer,
                )) {
                    this.logger.error({
                        msg: 'Signature and issuer don\'t match',
                        Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                        Event_value1: 'Signature and issuer not matching',
                    });
                    return resolve(false);
                }

                if (assertion.metadata.visibility) {
                    if (assertion.metadata.UAL && (!options || (options && options.isAsset))) {
                        const uai = assertion.metadata.UAL.split('/').pop();
                        const {
                            issuer,
                            assertionId,
                        } = await this.blockchainService.getAssetProofs(uai);
                        // if (assertionId !== assertion.id) {
                        //     this.logger.error({
                        //         msg: `Assertion ${assertion.id} doesn't match with calculated ${assertionId}`,
                        //         Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                        //         Event_value1: 'AssertionId not matching calculated',
                        //     });
                        //     return resolve(false);
                        // }
                        if (issuer.toLowerCase() !== assertion.metadata.issuer.toLowerCase()) {
                            this.logger.error({
                                msg: `Issuer ${issuer} doesn't match with received ${assertion.metadata.issuer}`,
                                Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                                Event_value1: 'Issuer not matching',
                            });
                            return resolve(false);
                        }
                    } else {
                        const calculateRootHash = this.validationService.calculateRootHash(
                            [...new Set(rdf)],
                        );
                        const { rootHash, issuer } = await this.blockchainService
                            .getAssertionProofs(assertion.id);
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
            const assertions = await this.tripleStoreQueue.push({
                operation: 'findAssetsByKeyword', query, options, localQuery,
            });
            if (!assertions) return null;
            const result = [];
            for (let assertion of assertions) {
                assertion.assertionId = assertion.assertionId.value.replace(`${constants.DID_PREFIX}:`, '');
                const { assertionId } = assertion;
                let { value: assetId } = assertion.assetId;
                assetId = assetId.split('/').pop();
                const {
                    assertionId: assertionIdBlockchain,
                } = await this.blockchainService.getAssetProofs(assetId);

                if (assertionIdBlockchain !== assertionId) {
                    continue;
                }

                const metadataOnly = true
                const nquads = await this.resolve(assertion.assertionId, localQuery, metadataOnly);

                if (!nquads) {
                    continue;
                }

                if (localQuery) {
                    assertion = await this.createAssertion(nquads, metadataOnly);

                    let object = result.find(
                        (x) => x.type === assertion.jsonld.metadata.type
                            && x.id === assertion.jsonld.metadata.UAL,
                    );
                    if (!object) {
                        object = {
                            id: assertion.jsonld.metadata.UAL,
                            type: assertion.jsonld.metadata.type,
                            timestamp: assertion.jsonld.metadata.timestamp,
                            issuers: [],
                            assertions: [],
                            previewData: assertion.jsonld.previewData,
                            blockchain: assertion.jsonld.blockchain,
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
                    if (
                        new Date(object.timestamp) < new Date(assertion.jsonld.metadata.timestamp)
                    ) {
                        object.timestamp = assertion.jsonld.metadata.timestamp;
                    }
                } else {
                    let object = result.find((x) => x.id === assertionId);
                    if (!object) {
                        object = {
                            assertionId,
                            node: this.networkService.getPeerId(),
                            nquads,
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
            const assertions = await this.tripleStoreQueue.push({
                operation: 'findAssertionsByKeyword', query, options, localQuery,
            });
            if (!assertions) return null;

            const result = [];
            for (let assertion of assertions) {
                const assertionId = assertion.assertionId = assertion.assertionId.value.replace(`${constants.DID_PREFIX}:`, '');

                const metadataOnly = true;
                const nquads = await this.resolve(assertion.assertionId, localQuery, metadataOnly);

                if (!nquads) {
                    continue;
                }

                if (localQuery) {
                    assertion = await this.createAssertion(nquads);
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
                            nquads,
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
                const result = await this.tripleStoreQueue.push({ operation: 'findAssertions', nquad });
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
        const quads = [];

        try {
            switch (type) {
            case 'SELECT':
                result = await this.tripleStoreQueue.push({ operation: 'select', query });
                break;
            case 'CONSTRUCT':
                result = await this.tripleStoreQueue.push({ operation: 'construct', query });
                result = result.toString();
                if (result) {
                    result = result.split('\n').filter((x) => x !== '');
                } else {
                    result = [];
                }
                await this.N3Parser.parse(
                    result.join('\n'),
                    (error, quad, prefixes) => {
                        if (quad) {
                            quads.push({
                                subject: quad._subject.id,
                                predicate: quad.predicate.id,
                                object: quad.object.id,
                            });
                        }
                    },
                );
                result = quads;

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
        switch (type.toLowerCase()) {
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
        case this.constants.ERC721:
        case this.constants.OTTELEMETRY:
            context = {
                '@context': 'https://www.schema.org/',
            };
            frame = {
                '@context': 'https://www.schema.org/',
                '@type': type,
            };
            break;
        default:
            context = {
                '@context': 'https://www.schema.org/',
            };

            frame = {
                '@context': 'https://www.schema.org/',
                '@type': type
            };
        }
        const json = await this.workerPool.exec('fromNQuads', [nquads, context, frame]);

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
            hasUAL : {"@id": assertion.metadata.UAL},
        };

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

    async extractPreviewData(rdf, uai) {
        return new Promise(async (accept, reject) => {
            const parser = new N3.Parser({ format: 'N-Triples', baseIRI: 'http://schema.org/' });
            const result = {};

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
                    if(quad._subject.id === uai) {
                        switch (quad._predicate.id) {
                            case 'http://schema.org/image':
                                result.image = quad._object.id;
                                break;
                            case 'http://schema.org/url':
                                result.url = quad._object.id;
                                break;
                            case 'http://schema.org/description':
                                result.description = quad._object.id;
                                break;
                            case 'http://schema.org/name':
                                result.name = quad._object.id;
                                break;
                            default:
                                break;
                            }
                    }
                } catch (e) {
                    this.logger.error({
                        msg: `Error in extracting preview data: ${e}. ${e.stack}`,
                        Event_name: constants.ERROR_TYPE.EXTRACT_PREVIEWDATA_ERROR,
                    });
                }
            }

            accept(result);
        });
    }

    async extractMetadata(rdf) {
        return new Promise(async (accept, reject) => {
            const parser = new N3.Parser({ format: 'N-Triples', baseIRI: 'http://schema.org/' });
            const result = {
                metadata: {
                    keywords: [],
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
                    case 'http://schema.org/hasUAL':
                        result.metadata.UAL = quad._object.id;
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

            accept(result);
        });
    }

    async handleTripleStoreRequest(args) {
        if (this.getTripleStoreQueueLength() > constants.TRIPLE_STORE_QUEUE_LIMIT) {
            throw new Error('Triple store queue is full');
        }
        const { operation } = args;
        let result;

        switch (operation) {
        case 'insert':
            result = await this.implementation.insert(args.data, args.assertionId);
            break;
        case 'resolve':
            result = await this.implementation.resolve(args.id, args.localQuery, args.metadataOnly);
            break;
        case 'assertionsByAsset':
            result = await this.implementation.assertionsByAsset(args.id);
            break;
        case 'findAssetsByKeyword':
            result = await this.implementation.findAssetsByKeyword(
                args.query,
                args.options,
                args.localQuery,
            );
            break;
        case 'findAssertionsByKeyword':
            result = await this.implementation.findAssertionsByKeyword(
                args.query,
                args.options,
                args.localQuery,
            );
            break;
        case 'construct':
            result = await this.implementation.construct(args.query);
            break;
        case 'findAssertions':
            result = await this.implementation.findAssertions(args.nquad);
            break;
        case 'select':
            result = await this.implementation.execute(args.query);
            break;
        default:
            throw new Error('Unknown operation for triple store');
        }

        return result;
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

    isNodeBusy(busynessLimit) {
        const isTripleStoreBusy = this.getTripleStoreQueueLength() > busynessLimit;
        const isToobusy = toobusy();
        if (isTripleStoreBusy) {
            this.logger.info('TripleStore is busy.');
        }
        if (isToobusy) {
            this.logger.info('Node is busy.');
        }
        return isToobusy || isTripleStoreBusy;
    }
}

module.exports = DataService;
