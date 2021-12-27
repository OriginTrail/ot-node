const {v1: uuidv1} = require('uuid');
const jsonld = require("jsonld");
const constants = require("constants");
const {sort} = require("fast-sort");
const N3 = require('n3');
const Bootstrap = require("libp2p-bootstrap");
const Libp2p = require("libp2p");

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.constants = ctx.constants;
        this.validationService = ctx.validationService;
    }

    initialize(implementation) {
        this.data = implementation;
        return this.data.initialize(this.logger);
    }

    async canonize(fileContent, fileExtension) {
        switch (fileExtension) {
            case '.json':
                let jsonContent = JSON.parse(fileContent);

                const timestamp = new Date().toISOString();
                const rdf = await this.data.toRDF(jsonContent);

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
                            timestamp
                        },
                    },
                    rdf
                };
            default:
                throw new Error('File format is not supported.')
        }
    }

    async insert(data, rootHash) {
        return this.data.insert(data, rootHash);
    }


    async resolve(assertionId, localQuery = false) {
        let rdf = await this.data.resolve(assertionId);
        if (!localQuery && rdf && rdf.find(x => x.includes(`<did:dkg:${assertionId}> <http://schema.org/hasVisibility> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> .`))) {
            return null;
        }
        return rdf;
    }

    async createAssertion(assertionId, rdf) {
        let metadata = rdf.filter(x => x.startsWith('<did:dkg:'))
        let data = rdf.filter(x => !x.startsWith('<did:dkg:'))
        rdf = rdf.filter(x => !x.includes('hasKeyword') && !x.includes('hasAsset') && !x.includes('hasRootHash') && !x.includes('hasBlockchain') && !x.includes('hasTransactionHash'))
        const assertion = await this.data.extractMetadata(metadata);
        assertion.id = assertionId;
        assertion.data = data;
        return {assertion, rdf};
    }

    verifyAssertion(assertion, rdf) {
        return new Promise(async (resolve) => {
            try {
                const array = rdf.join('\n').match(/<did:dkg:(.)+>/gm)
                if (array.find(x => !x.includes(`<did:dkg:${assertion.id}>`))) {
                    this.logger.error(`Invalid assertion in named graph`);
                    resolve(false);
                }

                // let dataHash;
                // if (assertion.metadata.visibility) {
                //     const framedData = await this.fromRDF(assertion.data, assertion.metadata.type);
                //     dataHash = this.validationService.calculateHash(framedData);
                // } else {
                //     dataHash = assertion.metadata.dataHash;
                // }
                let dataHash = assertion.metadata.dataHash;

                const metadataHash = this.validationService.calculateHash(assertion.metadata);
                const calculatedAssertionId = this.validationService.calculateHash(metadataHash + dataHash);
                if (assertion.id !== calculatedAssertionId) {
                    this.logger.error(`Assertion Id ${assertion.id} doesn\'t match with calculated ${calculatedAssertionId}`);
                    return resolve(false);
                }

                if (!this.validationService.verify(assertion.id, assertion.signature, assertion.metadata.issuer)) {
                    this.logger.error(`Signature and issuer don't match`);
                    return resolve(false);
                }

                if (assertion.metadata.visibility) {
                    const calculateRootHash = this.validationService.calculateRootHash(rdf);
                    if (assertion.rootHash !== calculateRootHash) {
                        this.logger.error(`Root hash ${assertion.rootHash} doesn\'t match with calculated ${calculateRootHash}`);
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
        let assets = await this.data.searchByQuery(query, options, localQuery);
        if (!assets)
            return null;

        const result = [];
        for (const asset of assets) {
            const assertions = asset.assertions.value.split(',').filter((x) => x !== '');
            for (let assertionId of assertions) {
                assertionId = assertionId.replace('did:dkg:', '');

                let rawRdf = await this.resolve(assertionId, localQuery);
                if (!rawRdf)
                    continue;

                if (localQuery) {
                    const {assertion, rdf} = await this.createAssertion(assertionId, rawRdf);

                    let object = result.find(x => x.type === assertion.metadata.type && x.id === asset.assetId.value)
                    if (!object) {
                        object = {
                            type: assertion.metadata.type,
                            id: asset.assetId.value,
                            timestamp: assertion.metadata.timestamp,
                            data: [],
                            issuers: [],
                            assertions: [],
                            nodes: [this.config.network.implementation.config.id]
                        }
                        result.push(object)
                    }


                    if (object.issuers.indexOf(assertion.metadata.issuer) === -1) {
                        object.issuers.push(assertion.metadata.issuer);
                    }

                    if (object.assertions.indexOf(assertion.id) === -1) {
                        object.assertions.push(assertion.id);
                        object.data.push({
                            id: assertion.id,
                            timestamp: assertion.metadata.timestamp,
                            data: assertion.data
                        });
                    }
                    if (new Date(object.timestamp) < new Date(assertion.metadata.timestamp)) {
                        object.timestamp = assertion.metadata.timestamp;
                    }
                } else {
                    let object = result.find(x => x.assetId === asset.assetId.value)
                    if (!object) {
                        object = {
                            assetId: asset.assetId.value,
                            assertions: []
                        }
                        result.push(object)
                    }
                    if (!object.assertions.find(x => x.id === assertionId)) {
                        object.assertions.push({
                            id: assertionId,
                            node: this.config.network.implementation.config.id,
                            rdf: rawRdf
                        });
                    }
                }
            }
        }

        return result;
    }

    async searchByIds(ids, options, localQuery = false) {
        let assets = await this.data.searchByIds(ids, options, localQuery);
        if (!assets)
            return null;

        const result = [];
        for (const asset of assets) {
            const assertions = asset.assertions.value.split(',').filter((x) => x !== '');
            for (let assertionId of assertions) {
                assertionId = assertionId.replace('did:dkg:', '');

                let rawRdf = await this.resolve(assertionId, localQuery);
                if (!rawRdf)
                    continue;

                if (localQuery) {
                    const {assertion, rdf} = await this.createAssertion(assertionId, rawRdf);

                    let object = result.find(x => x.type === assertion.metadata.type && x.id === asset.assetId.value)
                    if (!object) {
                        object = {
                            type: assertion.metadata.type,
                            id: asset.assetId.value,
                            timestamp: assertion.metadata.timestamp,
                            data: [],
                            issuers: [],
                            assertions: [],
                            nodes: [this.config.network.implementation.config.id]
                        }
                        result.push(object)
                    }


                    if (object.issuers.indexOf(assertion.metadata.issuer) === -1) {
                        object.issuers.push(assertion.metadata.issuer);
                    }

                    if (object.assertions.indexOf(assertion.id) === -1) {
                        object.assertions.push(assertion.id);
                        object.data.push({
                            id: assertion.id,
                            timestamp: assertion.metadata.timestamp,
                            data: assertion.data
                        });
                    }
                    if (new Date(object.timestamp) < new Date(assertion.metadata.timestamp)) {
                        object.timestamp = assertion.metadata.timestamp;
                    }
                } else {
                    let object = result.find(x => x.assetId === asset.assetId.value)
                    if (!object) {
                        object = {
                            assetId: asset.assetId.value,
                            assertions: []
                        }
                        result.push(object)
                    }
                    if (!object.assertions.find(x => x.id === assertionId)) {
                        object.assertions.push({
                            id: assertionId,
                            node: this.config.network.implementation.config.id,
                            rdf: rawRdf
                        });
                    }
                }
            }
        }

        return result;
    }


    async searchAssertions(query, options, localQuery = false) {
        let assets = await this.data.searchByQuery(query, options, localQuery);
        if (!assets)
            return null;

        const result = [];
        for (const asset of assets) {
            const assertions = asset.assertions.value.split(',').filter((x) => x !== '');
            for (let assertionId of assertions) {
                assertionId = assertionId.replace('did:dkg:', '');

                let rawRdf = await this.resolve(assertionId, localQuery);
                if (!rawRdf)
                    continue;

                if (localQuery) {
                    const {assertion, rdf} = await this.createAssertion(assertionId, rawRdf);
                    let object = result.find(x => x.id === assertion.id)
                    if (!object) {
                        object = {
                            id: assertion.id,
                            metadata: assertion.metadata,
                            signature: assertion.signature,
                            rootHash: assertion.rootHash,
                            nodes: [this.config.network.implementation.config.id]
                        }
                        result.push(object)
                    }
                } else {
                    let object = result.find(x => x.id === assertionId)
                    if (!object) {
                        object = {
                            assertionId,
                            node: this.config.network.implementation.config.id,
                            rdf: rawRdf,
                        }
                        result.push(object)
                    }
                }
            }
        }

        return result;
    }

    async findAssertions(nquads) {
        let assertions = [];
        for (const nquad of nquads) {
            const result = await this.data.findAssertions(nquad);
            assertions = [...new Set(assertions.concat(result))];
        }

        return assertions;
    }

    runQuery(query, type) {
        const Id_operation = uuidv1();
        let result = {};
        this.logger.emit({
            msg: 'Started measuring execution of query node',
            Event_name: 'query_node_start',
            Operation_name: 'query_node',
            Id_operation,
        });
        switch (type) {
            // case 'SELECT':
            //     result = this.data.execute(query);
            //     break;
            case 'CONSTRUCT':
                result = this.data.construct(query);
                break;
            // case 'ASK':
            //     result = this.data.ask(query);
            //     break;
            default:
                throw Error('Query type not supported');
        }
        this.logger.emit({
            msg: 'Finished measuring execution of query node',
            Event_name: 'query_node_end',
            Operation_name: 'query_node',
            Id_operation,
        });
        return result;
    }

    filter(assertion) {
        return assertion;
    }

    merge(assertions, assertion) {
        if (!assertions)
            return assertion;

        return `${assertions}\n${assertion}`;
    }

    async fromRDF(rdf, type) {
        let context, frame;
        switch (type) {
            case this.constants.GS1EPCIS:
                context = {
                    "@context": [
                        "https://gs1.github.io/EPCIS/epcis-context.jsonld",
                        {
                            "example": "http://ns.example.com/epcis/"
                        }
                    ],
                };

                frame = {
                    "@context": [
                        "https://gs1.github.io/EPCIS/epcis-context.jsonld",
                        {
                            "example": "http://ns.example.com/epcis/"
                        }
                    ],
                    "isA": "EPCISDocument"
                }
                break;
            default:
                context = {
                    "@context": ["https://www.schema.org/"],
                };

                frame = {}
        }

        const data = await this.data.fromRDF(rdf, context, frame);
        return data;
        //return sort(data).asc();
    }

    async frameAsset(data, type, framingCriteria) {
        data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let latest = data[0].data;
        for (let i = 1; i < data.length; i += 1) {
            let next = data[i].data;

            for (const row of latest) {
                if (!next.find(x => x.includes(row.split(' ')[1])))
                    next.push(row);
            }

            latest = next;
        }

        const jsonld = await this.fromRDF(latest, type);
        return jsonld;
    }


    async metadataQuery(log_exp_topics) {
        let metadata = [];
        let dataOntology = '';
        const namedGraphs = await this.data.getNamedGraphsByTopic(log_exp_topics);
        for (const ng of namedGraphs) {
            dataOntology = await this.data.getDataOntologyForNamedGraph(ng);
            if (dataOntology) {
                let newMetadata;
                switch (dataOntology) {
                    case 'VerifiableCredentials':
                        newMetadata = await this.data.getVerifiableCredentialsMetadata(ng);
                        metadata = metadata.concat(newMetadata);
                        break;
                    default:
                        metadata = {};
                        break;
                }
            }
        }
        return {triples: metadata, rootHashes: []};
    }

    dataQuery(query) {
        return this.data.dataQuery(query);
    }

    healthCheck() {
        return this.data.healthCheck();
    }

    restartService() {
        return this.data.restartService();
    }

    async appendMetadata(rdf, assertion) {
        const metadata = await this.data.createMetadata(assertion);
        rdf = rdf.concat(metadata);
        return rdf;
    }

    async appendBlockchainMetadata(rdf, assertion) {
        const metadata = await this.data.createBlockchainMetadata(assertion);
        rdf = rdf.concat(metadata);
        return rdf;
    }

    async appendConnections(rdf, options) {
        const connections = await this.data.createConnections(options);
        rdf = rdf.concat(connections);
        return rdf;
    }

    removeOntologyMetadata(assertions, ontologies, options) {
        switch (ontologies.dataOntology) {
            case 'VerifiableCredentials':
                assertions.splice(assertions.indexOf(assertions.find((triplet) => triplet.includes('has_data_ontology'))), 1);
                assertions.splice(assertions.indexOf(assertions.find((triplet) => triplet.includes('<http://schema.org/roothash>'))), 1);
                break;
            default:
                this.logger.error('Using unsupported data ontology.');
                break;
        }
        return assertions;
    }

    //
    // async transformData(assertions, ontologies, options) {
    //     for (const func of this.transformationFunctions) {
    //         assertions = await this[`${func}`](assertions, ontologies, options);
    //     }
    //
    //     return assertions;
    // }
    //
    // filter(assertions, ontologies, options) {
    //     this.logger.info(`Filtering assertions for data ontology: ${ontologies.dataOntology}`);
    //     return assertions;
    // }
    //
    // merge(assertions, ontologies, options) {
    //     this.logger.info('Merging assertions');
    //     assertions = assertions.filter((triplet, index, self) => index === self.findIndex((t) => (
    //         t === triplet
    //     )));
    //
    //     return assertions;
    // }
    //
    // format(assertions, ontologies, options) {
    //     this.logger.info('Formating assertions');
    // }
}

module.exports = DataService;
