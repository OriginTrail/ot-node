const { v1: uuidv1 } = require('uuid');
const constants = require('../constants');
const GraphDB = require('../../external/graphdb-service');

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.constants = ctx.constants;
        this.validationService = ctx.validationService;
        this.networkService = ctx.networkService;
        this.nodeService = ctx.nodeService;
    }

    getName() {
        return this.implementation.getName();
    }

    async initialize() {
        this.implementation = new GraphDB({
            repositoryName: this.config.graphDatabase.name,
            username: this.config.graphDatabase.username,
            password: this.config.graphDatabase.password,
        });

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
                msg: `Triple Store (${this.implementation.getName()}) not available, max retries reached.`,
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
            let jsonContent = JSON.parse(fileContent);

            const timestamp = new Date().toISOString();
            const rdf = await this.implementation.toRDF(jsonContent);

            let type = jsonContent['@type'];
            delete jsonContent['@type'];
            if (!type) {
                type = 'default';
            }

            jsonContent = await this.fromRDF(rdf, type);
            return {
                assertion: {
                    data: jsonContent,
                    metadata: {
                        type,
                        timestamp,
                    },
                },
                rdf,
            };
        default:
            throw new Error('File format is not supported.');
        }
    }

    async insert(data, rootHash) {
        try {
            return this.implementation.insert(data, rootHash);
        } catch (e) {
            // TODO: Check situation when inserting data recieved from other node
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async resolve(assertionId, localQuery = false) {
        try {
            const rdf = await this.implementation.resolve(assertionId);
            if (!localQuery && rdf && rdf.find((x) => x.includes(`<did:dkg:${assertionId}> <http://schema.org/hasVisibility> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> .`))) {
                return null;
            }
            return rdf;
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async createAssertion(assertionId, rdf) {
        const metadata = rdf.filter((x) => x.startsWith('<did:dkg:'));
        const data = rdf.filter((x) => !x.startsWith('<did:dkg:'));
        rdf = rdf.filter((x) => !x.includes('hasKeyword') && !x.includes('hasAsset') && !x.includes('hasRootHash') && !x.includes('hasBlockchain') && !x.includes('hasTransactionHash'));
        const assertion = await this.implementation.extractMetadata(metadata);
        assertion.id = assertionId;
        assertion.data = data;
        return { assertion, rdf };
    }

    verifyAssertion(assertion, rdf) {
        return new Promise(async (resolve) => {
            try {
                const array = rdf.join('\n').match(/<did:dkg:(.)+>/gm)
                if (array.find(x => !x.includes(`<did:dkg:${assertion.id}>`))) {
                    this.logger.error({
                        msg: 'Invalid assertion in named graph',
                        Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                        Event_value1: 'Invalid assertion in named graph',
                    });
                    resolve(false);
                }

                // let dataHash;
                // if (assertion.metadata.visibility) {
                //     const framedData = await this.fromRDF(assertion.data, assertion.metadata.type);
                //     dataHash = this.validationService.calculateHash(framedData);
                // } else {
                //     dataHash = assertion.metadata.dataHash;
                // }
                const { dataHash } = assertion.metadata;

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
                    const calculateRootHash = this.validationService.calculateRootHash(rdf);
                    if (assertion.rootHash !== calculateRootHash) {
                        this.logger.error({
                            msg: `Root hash ${assertion.rootHash} doesn't match with calculated ${calculateRootHash}`,
                            Event_name: constants.ERROR_TYPE.VERIFY_ASSERTION_ERROR,
                            Event_value1: 'Root hash not matching calculated',
                        });
                        return resolve(false);
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
            const assets = await this.implementation.searchByQuery(query, options, localQuery);
            if (!assets) return null;

            const result = [];
            for (const asset of assets) {
                const assertions = asset.assertions.value.split(',').filter((x) => x !== '');
                for (let assertionId of assertions) {
                    assertionId = assertionId.replace('did:dkg:', '');

                    const rawRdf = await this.resolve(assertionId, localQuery);
                    if (!rawRdf) continue;

                    if (localQuery) {
                        const {assertion, rdf} = await this.createAssertion(assertionId, rawRdf);

                        let object = result.find((x) => x.type === assertion.metadata.type && x.id === asset.assetId.value);
                        if (!object) {
                            object = {
                                type: assertion.metadata.type,
                                id: asset.assetId.value,
                                timestamp: assertion.metadata.timestamp,
                                data: [],
                                issuers: [],
                                assertions: [],
                                nodes: [this.networkService.getPeerId()],
                            };
                            result.push(object);
                        }

                        if (object.issuers.indexOf(assertion.metadata.issuer) === -1) {
                            object.issuers.push(assertion.metadata.issuer);
                        }

                        if (object.assertions.indexOf(assertion.id) === -1) {
                            object.assertions.push(assertion.id);
                            object.data.push({
                                id: assertion.id,
                                timestamp: assertion.metadata.timestamp,
                                data: assertion.data,
                            });
                        }
                        if (new Date(object.timestamp) < new Date(assertion.metadata.timestamp)) {
                            object.timestamp = assertion.metadata.timestamp;
                        }
                    } else {
                        let object = result.find((x) => x.assetId === asset.assetId.value);
                        if (!object) {
                            object = {
                                assetId: asset.assetId.value,
                                assertions: [],
                            };
                            result.push(object);
                        }
                        if (!object.assertions.find((x) => x.id === assertionId)) {
                            object.assertions.push({
                                id: assertionId,
                                node: this.networkService.getPeerId(),
                                rdf: rawRdf,
                            });
                        }
                    }
                }
            }

            return result;
        } catch (e) {
            this.handleUnavailableTripleStoreError(e);
        }
    }

    async searchByIds(ids, options, localQuery = false) {
        try {
            const assets = await this.implementation.searchByIds(ids, options, localQuery);
            if (!assets) return null;

            const result = [];
            for (const asset of assets) {
                const assertions = asset.assertions.value.split(',').filter((x) => x !== '');
                for (let assertionId of assertions) {
                    assertionId = assertionId.replace('did:dkg:', '');

                    const rawRdf = await this.resolve(assertionId, localQuery);
                    if (!rawRdf) continue;

                    if (localQuery) {
                        const { assertion, rdf } = await this.createAssertion(assertionId, rawRdf);

                        let object = result.find((x) => x.type === assertion.metadata.type && x.id === asset.assetId.value);
                        if (!object) {
                            object = {
                                type: assertion.metadata.type,
                                id: asset.assetId.value,
                                timestamp: assertion.metadata.timestamp,
                                data: [],
                                issuers: [],
                                assertions: [],
                                nodes: [this.networkService.getPeerId()],
                            };
                            result.push(object);
                        }

                        if (object.issuers.indexOf(assertion.metadata.issuer) === -1) {
                            object.issuers.push(assertion.metadata.issuer);
                        }

                        if (object.assertions.indexOf(assertion.id) === -1) {
                            object.assertions.push(assertion.id);
                            object.data.push({
                                id: assertion.id,
                                timestamp: assertion.metadata.timestamp,
                                data: assertion.data,
                            });
                        }
                        if (new Date(object.timestamp) < new Date(assertion.metadata.timestamp)) {
                            object.timestamp = assertion.metadata.timestamp;
                        }
                    } else {
                        let object = result.find((x) => x.assetId === asset.assetId.value);
                        if (!object) {
                            object = {
                                assetId: asset.assetId.value,
                                assertions: [],
                            };
                            result.push(object);
                        }
                        if (!object.assertions.find((x) => x.id === assertionId)) {
                            object.assertions.push({
                                id: assertionId,
                                node: this.networkService.getPeerId(),
                                rdf: rawRdf,
                            });
                        }
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
            const assets = await this.implementation.searchByQuery(query, options, localQuery);
            if (!assets) return null;

            const result = [];
            for (const asset of assets) {
                const assertions = asset.assertions.value.split(',').filter((x) => x !== '');
                for (let assertionId of assertions) {
                    assertionId = assertionId.replace('did:dkg:', '');

                    const rawRdf = await this.resolve(assertionId, localQuery);
                    if (!rawRdf) continue;

                    if (localQuery) {
                        const {assertion, rdf} = await this.createAssertion(assertionId, rawRdf);
                        let object = result.find((x) => x.id === assertion.id);
                        if (!object) {
                            object = {
                                id: assertion.id,
                                metadata: assertion.metadata,
                                signature: assertion.signature,
                                rootHash: assertion.rootHash,
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
                                rdf: rawRdf,
                            };
                            result.push(object);
                        }
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

    async fromRDF(rdf, type) {
        const Id_operation = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of fromRDF command',
            Event_name: 'fromrdf_start',
            Operation_name: 'fromrdf',
            Id_operation,
        });
        let context; let
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
        default:
            context = {
                '@context': ['https://www.schema.org/'],
            };

            frame = {};
        }

        const data = await this.implementation.fromRDF(rdf, context, frame);
        this.logger.emit({
            msg: 'Finished measuring execution of fromRDF command',
            Event_name: 'fromrdf_end',
            Operation_name: 'fromrdf',
            Id_operation,
        });
        return data;
        // return sort(data).asc();
    }

    async frameAsset(data, type, framingCriteria) {
        data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let latest = data[0].data;
        for (let i = 1; i < data.length; i += 1) {
            const next = data[i].data;

            for (const row of latest) {
                if (!next.find((x) => x.includes(row.split(' ')[1]))) next.push(row);
            }

            latest = next;
        }

        const jsonld = await this.fromRDF(latest, type);
        return jsonld;
    }

    healthCheck() {
        return this.implementation.healthCheck();
    }

    restartService() {
        return this.implementation.restartService();
    }

    async appendMetadata(rdf, assertion) {
        const metadata = await this.implementation.createMetadata(assertion);
        rdf = rdf.concat(metadata);
        return rdf;
    }

    async appendBlockchainMetadata(rdf, assertion) {
        const metadata = await this.implementation.createBlockchainMetadata(assertion);
        rdf = rdf.concat(metadata);
        return rdf;
    }

    async appendConnections(rdf, options) {
        const connections = await this.implementation.createConnections(options);
        rdf = rdf.concat(connections);
        return rdf;
    }

    handleUnavailableTripleStoreError(e) {
        if (e.code === 'ECONNREFUSED') {
            this.logger.error({
                msg: `Triple Store (${this.implementation.getName()}) not available: ${e.message}. ${e.stack}`,
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
