const { sha3_256 } = require('js-sha3');
const { forEach, forEachSeries } = require('p-iteration');

const Utilities = require('../Utilities');
const EpcisOtJsonTranspiler = require('../transpiler/epcis/epcis-otjson-transpiler');
const ImportUtilities = require('../ImportUtilities');
const Validator = require('../validation-schemas');

// Helper functions.

/**
 * Returns value of '@id' property.
 * @param jsonLdObject JSON-LD object.
 * @return {string}
 * @private
 */
function _id(jsonLdObject) {
    return jsonLdObject['@id'];
}

/**
 * Returns value of '@type' property.
 * @param jsonLdObject JSON-LD object.
 * @return {string}
 * @private
 */
function _type(jsonLdObject) {
    return jsonLdObject['@type'];
}

/**
 * Returns value of '@value' property.
 * @param jsonLdObject JSON-LD object.
 * @return {string}
 * @private
 */
function _value(jsonLdObject) {
    return jsonLdObject['@value'];
}

/**
 * Returns value of '@context' property.
 * @param jsonLdObject JSON-LD object
 * @returns {*}
 * @private
 */
function _context(jsonLdObject) {
    return jsonLdObject['@context'];
}


/**
 * Calculate SHA3 from input objects and return normalized hex string.
 * @param rest An array of input data concatenated before calculating the hash.
 * @return {string} Normalized hash string.
 * @private
 */
function _keyFrom(...rest) {
    return Utilities.normalizeHex(sha3_256([...rest].reduce(
        (acc, argument) => {
            acc += Utilities.stringify(argument, 0);
            return acc;
        },
        '',
    )));
}

/**
 * Constants used in graph creation.
 * @type {{
 * relationType: {
 *  identifies: string, hasData: string, identifiedBy: string, connectionDownstream: string},
 *  vertexType: {
 *  entityObject: string, identifier: string, data: string, connector: string},
 * edgeType: {
 *  connectorRelation: string, dataRelation: string, otRelation: string,
 *  identifierRelation: string},
 * objectType: {
 *  otConnector: string, otObject: string}}}
 */
const constants = {
    vertexType: {
        entityObject: 'EntityObject',
        identifier: 'Identifier',
        data: 'Data',
        connector: 'Connector',
    },
    edgeType: {
        identifierRelation: 'IdentifierRelation',
        dataRelation: 'dataRelation',
        otRelation: 'otRelation',
        connectorRelation: 'ConnectorRelation',
    },
    objectType: {
        otObject: 'otObject',
        otConnector: 'otConnector',
    },
    relationType: {
        identifies: 'IDENTIFIES',
        identifiedBy: 'IDENTIFIED_BY',
        hasData: 'HAS_DATA',
        connectionDownstream: 'CONNECTION_DOWNSTREAM',
    },
};
Object.freeze(constants);

/**
 *
 */
class OtJsonImporter {
    /**
     * Default constructor. Creates instance of otJsonImporter.
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.db = ctx.graphStorage;
        this.log = ctx.logger;
        this.config = ctx.config;
        this.notifyError = ctx.notifyError;
        this.web3 = ctx.web3;

        // TODO: use creditor information from config.
        this.me = {
            dataCreator: {
                identifiers: [
                    {
                        identifierValue: '0x00624f564D433Db4449Ee10Cdc2cCcdcf46beb68',
                        identifierType: 'ERC725',
                        validationSchema: '/schemas/erc725-main',
                    },
                ],
            },
        };
    }

    /**
     * Imports OTJSON document
     * @param data { document, encryptedMap }
     * @returns {Promise<{root_hash: string, vertices: Array, edges: Array, data_set_id: string, wallet: string}>}
     */
    async importFile(data) {
        const {
            document,
            encryptedMap,
        } = data;

        // TODO: validate document here.
        this._validate(document);

        const datasetId = _id(document);
        const header = document.datasetHeader;
        const dataCreator = document.datasetHeader.dataCreator.identifiers[0].identifierValue;

        // Result
        const vertices = [];
        const edges = [];

        document['@graph'].forEach((otObject) => {
            switch (_type(otObject)) {
            case constants.objectType.otObject: {
                // Create entity vertex.
                const entityVertex = {};
                entityVertex._key = _keyFrom(dataCreator, _id(otObject));
                entityVertex.uid = _id(otObject);
                entityVertex.vertexType = constants.vertexType.entityObject;
                // TODO: videti sa aleksom da li ide .data.objectType
                entityVertex.objectType = constants.objectType.otObject;
                entityVertex.datasets = [datasetId];

                vertices.push(entityVertex);

                // Add identifiers.
                if (otObject.identifiers != null) {
                    otObject.identifiers.forEach((identifier) => {
                        // TODO: check for duplicates here.
                        // TODO: see what with autogenerated here?
                        const identifierVertex = {
                            _key: _keyFrom(_type(identifier), _value(identifier)),
                            identifierType: _type(identifier),
                            identifierValue: _value(identifier),
                            vertexType: constants.vertexType.identifier,
                            datasets: [datasetId],
                        };
                        vertices.push(identifierVertex);

                        // Add identity edge.
                        const identifyEdge = {
                            _key: _keyFrom(dataCreator, identifierVertex._key, entityVertex._key),
                            _from: identifierVertex._key,
                            _to: entityVertex._key,
                            relationType: constants.relationType.identifies,
                            edgeType: constants.edgeType.identifierRelation,
                            datasets: [datasetId],
                        };
                        if (identifier.autogenerated != null) {
                            identifyEdge.autogenerated = identifier.autogenerated;
                        }
                        edges.push(identifyEdge);

                        const identifiedByEdge = {
                            _key: _keyFrom(dataCreator, entityVertex._key, identifierVertex._key),
                            _from: entityVertex._key,
                            _to: identifierVertex._key,
                            relationType: constants.relationType.identifiedBy,
                            edgeType: constants.edgeType.identifierRelation,
                            datasets: [datasetId],
                        };
                        if (identifier.autogenerated != null) {
                            identifiedByEdge.autogenerated = identifier.autogenerated;
                        }
                        edges.push(identifiedByEdge);
                    });
                }

                // Add data vertex.
                if (otObject.properties != null) {
                    const dataVertex = {
                        _key: _keyFrom(dataCreator, _keyFrom(otObject.properties)),
                        vertexType: constants.vertexType.data,
                        data: otObject.properties,
                        datasets: [datasetId],
                    };
                    if (encryptedMap && encryptedMap[_id(otObject)]) {
                        dataVertex.encrypted = encryptedMap[_id(otObject)];
                    }
                    vertices.push(dataVertex);

                    // Add has-data edge.
                    const hasDataEdge = {
                        _key: _keyFrom(dataCreator, entityVertex._key, dataVertex._key),
                        _from: entityVertex._key,
                        _to: dataVertex._key,
                        edgeType: constants.edgeType.dataRelation,
                        relationType: constants.relationType.hasData,
                        datasets: [datasetId],
                    };
                    edges.push(hasDataEdge);
                }

                // Add relations edges.
                if (otObject.relations != null) {
                    otObject.relations.forEach((relation) => {
                        const relationEdge = {};
                        relationEdge._from = entityVertex._key;
                        relationEdge._to = _keyFrom(dataCreator, _id(relation.linkedObject));
                        relationEdge.edgeType = constants.edgeType.otRelation;
                        relationEdge.relationType = relation.properties.relationType;

                        if (relation.properties.type) {
                            relationEdge._key = _keyFrom(
                                dataCreator,
                                relationEdge._from,
                                relationEdge._to,
                                relationEdge.relationType,
                                relation.properties.type,
                            );
                        } else {
                            relationEdge._key = _keyFrom(
                                dataCreator,
                                relationEdge._from,
                                relationEdge._to,
                                relationEdge.relationType,
                            );
                        }
                        relationEdge.properties = relation.properties;
                        relationEdge.datasets = [datasetId];
                        edges.push(relationEdge);
                    });
                }
            }
                break;
            case constants.objectType.otConnector: {
                // Create connector vertex.
                const connectorVertex = {
                    _key: _keyFrom(dataCreator, _id(otObject)),
                    uid: _id(otObject),
                    connectionId: otObject.connectionId,
                    vertexType: constants.vertexType.connector,
                    objectType: constants.objectType.otConnector,
                    datasets: [datasetId],
                };
                vertices.push(connectorVertex);

                // Add relations edges.
                if (otObject.relations != null) {
                    otObject.relations.forEach((relation) => {
                        const relationEdge = {};
                        relationEdge._from = connectorVertex._key;
                        relationEdge._to = _keyFrom(dataCreator, _id(relation.linkedObject));
                        relationEdge._key =
                            _keyFrom(dataCreator, relationEdge._from, relationEdge._to);
                        relationEdge.edgeType = constants.edgeType.otRelation;
                        relationEdge.relationType = relation.properties.relationType;
                        relationEdge.properties = relation.properties;
                        relationEdge.datasets = [datasetId];
                        edges.push(relationEdge);
                    });
                }
            }
                break;
            default:
                throw Error('Unexpected vertex type in @graph.');
            }
        });

        const deduplicateVertices = [];
        const deduplicateEdges = [];

        for (const vertex of vertices) {
            const obj = deduplicateVertices.find(el => el._key === vertex._key);

            if (obj == null) {
                deduplicateVertices.push(vertex);
            }
        }

        for (const edge of edges) {
            const obj = deduplicateEdges.find(el => el._key === edge._key);

            if (obj == null) {
                deduplicateEdges.push(edge);
            }
        }

        const metadata = {
            _key: datasetId,
            datasetContext: _context(document),
            datasetHeader: document.datasetHeader,
            signature: document.signature,
            vertices: vertices.reduce((acc, current) => {
                if (!acc.includes(current._key)) {
                    acc.push(current._key);
                }
                return acc;
            }, []),
            edges: edges.reduce((acc, current) => {
                if (!acc.includes(current._key)) {
                    acc.push(current._key);
                }
                return acc;
            }, []),
        };

        // TODO: Check for datasetHeader.dataIntegrity.* proof here.

        // TODO enable commit operation
        // contents.vertices.map((v) => {
        //     v.inTransaction = true;
        //     return v;
        // });
        // contents.edges.map((e) => {
        //     e.inTransaction = true;
        //     return e;
        // });

        await forEachSeries(vertices, vertex => this.db.addVertex(vertex));
        await forEachSeries(edges, edge => this.db.addEdge(edge));

        await forEachSeries(vertices.filter(vertex => vertex.vertexType === 'Connector'), async (vertex) => {
            // Connect to other connectors if available.
            const relatedConnectors = await this.db.findConnectors(vertex.connectionId);

            await forEachSeries(relatedConnectors, async (relatedVertex) => {
                await this.db.addEdge({
                    _key: _keyFrom(dataCreator, vertex._key, relatedVertex._key),
                    _from: vertex._key,
                    _to: relatedVertex._key,
                    relationType: 'CONNECTION_DOWNSTREAM',
                    edgeType: 'ConnectorRelation',
                });

                // Other way. This time host node is the data creator.
                await this.db.addEdge({
                    _key: _keyFrom(this.me, relatedVertex._key, vertex._key),
                    _from: relatedVertex._key,
                    _to: vertex._key,
                    relationType: 'CONNECTION_DOWNSTREAM',
                    edgeType: 'ConnectorRelation',
                });
            });
        });

        await this.db.addDocument('ot_datasets', metadata);

        // Extract wallet from signature.
        const wallet = ImportUtilities.extractDatasetSigner(
            document,
            this.web3,
        );

        // TODO: Verify that signer's wallet belongs to dataCreator ERC

        // TODO enable commit operation
        // await this.db.commit();

        return {
            total_documents: document['@graph'].length,
            root_hash: document.datasetHeader.dataIntegrity.proofs[0].proofValue,
            vertices: deduplicateVertices,
            edges: deduplicateEdges,
            data_set_id: datasetId,
            wallet,

        };
    }

    async getImport(datasetId, encColor = null) {
        if (![null, 'red', 'green', 'blue'].includes(encColor)) {
            throw Error('Invalid encryption color.');
        }
        const vertices = await this.db.findVerticesByImportId(datasetId);
        const edges = await this.db.findEdgesByImportId(datasetId);
        const metadata = await this.db.findMetadataByImportId(datasetId);

        // TODO: Check if date with specified encryption exists
        if (encColor != null) {
            vertices.filter(v => v.encrypted != null)
                .forEach(v => v.data = v.encrypted[encColor.charAt(0)]);
        }

        const document = {
            '@id': datasetId,
            '@type': 'Dataset',
            '@graph': [],
        };

        document.datasetHeader = metadata.datasetHeader;
        document.signature = metadata.signature;

        vertices.filter(vertex => vertex.vertexType === 'EntityObject').forEach((entityVertex) => {
            const otObject = {
                '@type': 'otObject',
                '@id': entityVertex.uid,
                identifiers: [],
            };

            // Check for identifiers.
            // Relation 'IDENTIFIES' goes form identifierVertex to entityVertex.
            edges.filter(edge => (edge.edgeType === 'IdentifierRelation' && edge._to === entityVertex._key))
                .forEach((edge) => {
                    vertices.filter(vertices => vertices._key === edge._from)
                        .forEach((identityVertex) => {
                            if (edge.autogenerated != null) {
                                otObject.identifiers.push({
                                    '@type': identityVertex.identifierType,
                                    '@value': identityVertex.identifierValue,
                                    autogenerated: edge.autogenerated,
                                });
                            } else {
                                otObject.identifiers.push({
                                    '@type': identityVertex.identifierType,
                                    '@value': identityVertex.identifierValue,
                                });
                            }
                        });
                });
            // Check for properties.
            // Relation 'HAS_DATA' goes from entityVertex to dataVertex.
            edges.filter(edge => (edge.edgeType === 'dataRelation' && edge._from === entityVertex._key))
                .forEach((edge) => {
                    vertices.filter(vertices => vertices._key === edge._to)
                        .forEach((dataVertex) => {
                            otObject.properties = Utilities.copyObject(dataVertex.data);
                        });
                });
            // Check for relations.
            edges.filter(edge => (edge.edgeType === 'otRelation' && edge._from === entityVertex._key))
                .forEach((edge) => {
                    if (otObject.relations == null) {
                        otObject.relations = [];
                    }

                    // Find original vertex to get the @id.
                    const id = (vertices.filter(vertex => vertex._key === edge._to)[0]).uid;

                    otObject.relations.push({
                        '@type': 'otRelation',
                        direction: 'direct', // TODO: check this.
                        linkedObject: {
                            '@id': id,
                        },
                        properties: edge.properties,
                    });
                });
            document['@graph'].push(otObject);
        });

        vertices.filter(vertex => vertex.vertexType === 'Connector').forEach((connectorVertex) => {
            const otConnector = {
                '@type': 'otConnector',
                '@id': connectorVertex.uid,
                connectionId: connectorVertex.connectionId,
            };

            // Check for relations.
            edges.filter(edge => (edge.edgeType === 'otRelation' && edge._from === connectorVertex._key))
                .forEach((edge) => {
                    if (otConnector.relations == null) {
                        otConnector.relations = [];
                    }

                    // Find original vertex to get the @id.
                    const id = (vertices.filter(vertex => vertex._key === edge._to)[0]).uid;

                    otConnector.relations.push({
                        '@type': 'otRelation',
                        direction: 'reverse',
                        linkedObject: {
                            '@id': id,
                        },
                        properties: edge.properties,
                    });
                });

            document['@graph'].push(otConnector);
        });

        ImportUtilities.sortDataset(document);
        return document;
    }

    /**
     * Validates the JSON-LD document's metadata to be in valid OT-JSON format.
     * @param document JSON-LD document.
     * @private
     */
    _validate(document) {
        // Test root level of the document.
        // Expected:
        // {
        //     @id: '',
        //     @type: 'Dataset',
        //     datasetHeader: {},
        //     @graph: [],
        //     signature: {}
        // }

        if (document == null) {
            throw Error('Document cannot be null.');
        }

        if (typeof document !== 'object') {
            throw Error('Document has to be object.');
        }

        if (Object.keys(document).length !== 5) {
            throw Error('Lack of additional information in OT-JSON document.');
        }

        const datasetId = _id(document);
        const datasetType = _type(document);
        const { datasetHeader } = document;
        const graph = document['@graph'];

        if (typeof datasetId !== 'string') {
            throw Error('Wrong format of dataset ID');
        }

        if (datasetId !== ImportUtilities.calculateGraphHash(document['@graph'])) {
            throw Error('Invalid dataset ID');
        }

        if (datasetId !== ImportUtilities.calculateGraphHash(document['@graph'])) {
            throw Error('Invalid dataset ID');
        }

        if (datasetType !== 'Dataset') {
            throw Error('Unsupported dataset type.');
        }

        if (graph == null || !Array.isArray(graph) || graph.length === 0) {
            throw Error('Missing or empty graph.');
        }

        if (datasetHeader.OTJSONVersion !== '1.0') {
            throw Error('Unsupported OT-JSON version.');
        }

        if (datasetHeader.datasetCreationTimestamp == null &&
            !Number.isNaN(Date.parse(datasetHeader.datasetCreationTimestamp))) {
            throw Error('Invalid creation date.');
        }

        if (datasetHeader.dataCreator == null || datasetHeader.dataCreator.identifiers == null) {
            throw Error('Data creator is missing.');
        }

        const { identifiers } = datasetHeader.dataCreator;
        if (!Array.isArray(identifiers) || identifiers.length !== 1) {
            throw Error('Unexpected format of data creator.');
        }

        if (identifiers[0].identifierType !== 'ERC725' || identifiers[0].validationSchema !== '/schemas/erc725-main' ||
            !Utilities.isHexStrict(identifiers[0].identifierValue)) {
            throw Error('Wrong format of data creator.');
        }

        const { signature } = document;
        if (signature == null || typeof signature.type !== 'string' || typeof signature.value !== 'string') {
            throw Error('Wrong type or missing signature.');
        }

        // Schemas validation
        const validationResult = Validator.validateDataset(document);

        if (!validationResult.valid) {
            throw Error(`Invalid dataset: ${validationResult.message}`);
        } else {
            this.log.info('Dataset schemas validation successful');
        }
    }
}

module.exports = OtJsonImporter;
