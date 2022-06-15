const { v1: uuidv1 } = require('uuid');
const N3 = require('n3');
const toobusy = require('toobusy-js');
const constants = require('../constants');

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.constants = ctx.constants;
        this.validationModuleManager = ctx.validationModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.nodeService = ctx.nodeService;
        this.workerPool = ctx.workerPool;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
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
        return this.tripleStoreModuleManager.getName();
    }

    async initialize() {}

    async reinitalize() {
        this.tripleStoreModuleManager.reinitalize();
    }

    async canonize(fileContent, fileExtension) {
        switch (fileExtension) {
        case '.json':
            const assertion = {
                metadata: {
                    timestamp: new Date().toISOString(),
                },
                data: await this.workerPool.exec('JSONParse', [fileContent.toString()]),
            };
            const nquads = await this.workerPool.exec('toNQuads', [assertion.data]);
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
            let nquads = await this.tripleStoreQueue.push({ operation: 'resolve', id });
            if (nquads.length) {
                nquads = nquads.toString();
                nquads = nquads.split('\n');
                nquads = nquads.filter((x) => x !== '');
                // canonize nquads before roothash validation
                nquads = await this.workerPool.exec('toNQuads', [nquads.join('\n'), 'application/n-quads']);
            } else {
                nquads = null;
            }

            // TODO: add function for this conditional expr for increased readability
            if (!localQuery && nquads && nquads.find((x) => x.includes(`<${constants.DID_PREFIX}:${id}> <http://schema.org/hasVisibility> "private" .`))) {
                return null;
            }
            if (metadataOnly) {
                nquads = nquads.filter((x) => x.startsWith(`<${constants.DID_PREFIX}:${id}>`));
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
                id: x.assertionId.slice(8),
                issuer: x.issuer,
                timestamp: x.timestamp,
            }));
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async createAssertion(rawNQuads) {
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
        jsonld.data = data;
        return { jsonld, nquads };
    }

    verifyAssertion(assertion, rdf, options = undefined) {
        return new Promise(async (resolve) => {
            try {
                // let dataHash;
                // if (assertion.metadata.visibility) {
                //   const framedData = await this.fromRDF(assertion.data, assertion.metadata.type);
                //     dataHash = this.validationModuleManager.calculateHash(framedData);
                // } else {
                //     dataHash = assertion.metadata.dataHash;
                // }
                const { dataHash } = assertion.metadata;

                const metadataHash = this.validationModuleManager.calculateHash(assertion.metadata);
                const calculatedAssertionId = this.validationModuleManager.calculateHash(
                    metadataHash + dataHash,
                );
                if (assertion.id !== calculatedAssertionId) {
                    this.logger.error({
                        msg: `Assertion Id ${assertion.id} doesn't match with calculated ${calculatedAssertionId}`,
                        Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                        Event_value1: 'Assertion ID not matching calculated',
                    });
                    return resolve(false);
                }

                if (!this.validationModuleManager.verify(
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
                    if (assertion.metadata.UALs && (!options || (options && options.isAsset))) {
                        const {
                            issuer,
                            assertionId,
                        } = await this.blockchainModuleManager.getAssetProofs(assertion.metadata.UALs[0]);
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
                    } else {
                        const calculateRootHash = this.validationModuleManager.calculateRootHash(
                            [...new Set(rdf)],
                        );
                        const { rootHash, issuer } = await this.blockchainModuleManager
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
                assertion.assertionId = assertion.assertionId.replace(`${constants.DID_PREFIX}:`, '');
                const { assertionId } = assertion;
                const assetId = JSON.parse(assertion.assetId)

                const {
                    assertionId: assertionIdBlockchain,
                } = await this.blockchainModuleManager.getAssetProofs(assetId);

                if (assertionIdBlockchain !== assertionId) {
                    continue;
                }

                const nquads = await this.resolve(assertion.assertionId, localQuery, true);
                if (!nquads) {
                    continue;
                }

                if (localQuery) {
                    assertion = await this.createAssertion(nquads);

                    let object = result.find(
                        (x) => x.type === assertion.jsonld.metadata.type
                            && x.id === assertion.jsonld.metadata.UALs[0],
                    );
                    if (!object) {
                        object = {
                            id: assertion.jsonld.metadata.UALs[0],
                            type: assertion.jsonld.metadata.type,
                            timestamp: assertion.jsonld.metadata.timestamp,
                            issuers: [],
                            assertions: [],
                            nodes: [this.networkModuleManager.getPeerId()._idB58String],
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
                            node: this.networkModuleManager.getPeerId()._idB58String,
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
                const assertionId = assertion.assertionId = assertion.assertionId.replace(`${constants.DID_PREFIX}:`, '');
                const nquads = await this.resolve(assertion.assertionId, localQuery, true);
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
                            nodes: [this.networkModuleManager.getPeerId()._idB58String],
                        };
                        result.push(object);
                    }
                } else {
                    let object = result.find((x) => x.id === assertionId);
                    if (!object) {
                        object = {
                            assertionId,
                            node: this.networkModuleManager.getPeerId()._idB58String,
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
            //     result = this.tripleStoreModuleManager.ask(query);
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
                '@context': ['https://www.schema.org/'],
            };

            frame = {};
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
        return this.tripleStoreModuleManager.healthCheck();
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

        if (assertion.metadata.UALs) {
            metadata.hasUALs = assertion.metadata.UALs;
        }

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
        this.logger.debug('Extracting metadata from rdf');
        const parser = new N3.Parser({format: 'N-Triples', baseIRI: 'http://schema.org/'});
        const result = {
            keywords: []
        };

        const quads = [];
        await parser.parse(
            rdf.join('\n'),
            (error, quad) => {
                if (error) {
                    throw error;
                }
                if (quad) {
                    quads.push(quad);
                }
            },
        );

        for (const quad of quads) {
            try {
                switch (quad._predicate.id) {
                    case 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type':
                        result.type = JSON.parse(quad._object.id);
                        break;
                    case 'http://schema.org/visibility':
                        result.visibility = JSON.parse(quad._object.id);
                        break;
                    case 'http://schema.org/keywords':
                        result.keywords.push(JSON.parse(quad._object.id));
                        break;
                    case 'http://schema.org/issuer':
                        result.issuer = JSON.parse(quad._object.id);
                        break;
                    case 'http://schema.org/dataRootId':
                        result.dataRootId = JSON.parse(quad._object.id);
                        break;
                    default:
                        break;
                }
            } catch (e) {
                this.logger.error({
                    msg: `Error in extracting metadata: ${e}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.EXTRACT_METADATA_ERROR,
                });
                throw e;
            }
        }
        return result;
    }

    async handleTripleStoreRequest(args) {
        if (this.getTripleStoreQueueLength() > constants.TRIPLE_STORE_QUEUE_LIMIT) {
            throw new Error('Triple store queue is full');
        }
        const { operation } = args;
        let result;

        switch (operation) {
        case 'insert':
            result = await this.tripleStoreModuleManager.insert(args.data, args.assertionId);
            break;
        case 'resolve':
            result = await this.tripleStoreModuleManager.resolve(args.id);
            break;
        case 'assertionsByAsset':
            result = await this.tripleStoreModuleManager.assertionsByAsset(args.id);
            break;
        case 'findAssetsByKeyword':
            result = await this.tripleStoreModuleManager.findAssetsByKeyword(
                args.query,
                args.options,
                args.localQuery,
            );
            break;
        case 'findAssertionsByKeyword':
            result = await this.tripleStoreModuleManager.findAssertionsByKeyword(
                args.query,
                args.options,
                args.localQuery,
            );
            break;
        case 'construct':
            result = await this.tripleStoreModuleManager.construct(args.query);
            break;
        case 'findAssertions':
            result = await this.tripleStoreModuleManager.findAssertions(args.nquad);
            break;
        case 'select':
            result = await this.tripleStoreModuleManager.execute(args.query);
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
