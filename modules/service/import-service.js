const ImportUtilities = require('../ImportUtilities');
const Utilities = require('../Utilities');
const { sha3_256 } = require('js-sha3');
const { forEachSeries } = require('p-iteration');

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
 * Returns value of '@graph' property.
 * @param OT-JSON document object.
 * @return [Object]
 * @private
 */
function _graph(document) {
    return document['@graph'];
}

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

class ImportService {
    constructor(ctx) {
        this.db = ctx.graphStorage;
        this.schemaValidator = ctx.schemaValidator;
        this.web3 = ctx.web3;
        this.log = ctx.logger;
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
            '@graph': await this._createDocumentGraph(vertices, edges),
        };

        document.datasetHeader = metadata.datasetHeader;
        document.signature = metadata.signature;


        ImportUtilities.sortStringifyDataset(document);
        return document;
    }

    /**
     * Imports OTJSON document
     * @param data {{document: *, encryptedMap: null}}
     * @returns {
     * Promise<{
     * root_hash: string, vertices: Array, edges: Array, data_set_id: string, wallet: string}>}
     */
    async importFile(data) {
        const {
            document,
            encryptedMap,
        } = data;

        // TODO: validate document here.
        await this.validateDocument(document);

        const datasetId = _id(document);
        const header = document.datasetHeader;
        const dataCreator = document.datasetHeader.dataCreator.identifiers[0].identifierValue;

        // Result
        const vertices = [];
        const edges = [];
        const objectIds = [];
        document['@graph'].forEach((otObject) => {
            objectIds.push(Utilities.keyFrom(dataCreator, _id(otObject)));

            switch (_type(otObject)) {
            case constants.objectType.otObject: {
                // Create entity vertex.
                const entityVertex = {};
                entityVertex._key = Utilities.keyFrom(dataCreator, _id(otObject));
                entityVertex.uid = _id(otObject);
                entityVertex.vertexType = constants.vertexType.entityObject;
                // TODO: videti sa aleksom da li ide .data.objectType
                entityVertex.objectType = constants.objectType.otObject;
                entityVertex.datasets = [datasetId];

                vertices.push(entityVertex);

                // Add identifiers.
                if (otObject.identifiers != null) {
                    otObject.identifiers.forEach((identifier) => {
                        const identifierVertex = {
                            _key: Utilities.keyFrom(
                                _type(identifier),
                                _value(identifier),
                            ),
                            identifierType: _type(identifier),
                            identifierValue: _value(identifier),
                            vertexType: constants.vertexType.identifier,
                            datasets: [datasetId],
                        };
                        vertices.push(identifierVertex);

                        // Add identity edge.
                        const identifyEdge = {
                            _key: Utilities.keyFrom(
                                dataCreator,
                                identifierVertex._key,
                                entityVertex._key,
                            ),
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
                            _key: Utilities.keyFrom(
                                dataCreator,
                                entityVertex._key,
                                identifierVertex._key,
                            ),
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
                        _key: Utilities.keyFrom(
                            dataCreator,
                            Utilities.keyFrom(otObject.properties),
                        ),
                        vertexType: constants.vertexType.data,
                        data: otObject.properties,
                        datasets: [datasetId],
                    };
                    if (encryptedMap && encryptedMap.objects &&
                            encryptedMap.objects[_id(otObject)]) {
                        dataVertex.encrypted = encryptedMap.objects[_id(otObject)];
                    }
                    vertices.push(dataVertex);

                    // Add has-data edge.
                    const hasDataEdge = {
                        _key: Utilities.keyFrom(
                            dataCreator,
                            entityVertex._key,
                            dataVertex._key,
                        ),
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
                        relationEdge._to = Utilities.keyFrom(
                            dataCreator,
                            _id(relation.linkedObject),
                        );
                        relationEdge.edgeType = constants.edgeType.otRelation;
                        relationEdge.relationType = relation.relationType;
                        relationEdge._key = Utilities.keyFrom(
                            dataCreator,
                            relationEdge._from,
                            relationEdge._to,
                            relationEdge.relationType,
                        );
                        relationEdge.properties = relation.properties;
                        relationEdge.datasets = [datasetId];
                        if (encryptedMap && encryptedMap.relations &&
                                encryptedMap.relations[_id(otObject)]) {
                            const relationKey = sha3_256(Utilities.stringify(relation, 0));
                            relationEdge.encrypted =
                                    encryptedMap.relations[_id(otObject)][relationKey];
                        }
                        edges.push(relationEdge);
                    });
                }
            }
                break;
            case constants.objectType.otConnector: {
                // Create connector vertex.
                const connectorVertex = {
                    _key: Utilities.keyFrom(
                        dataCreator,
                        _id(otObject),
                    ),
                    uid: _id(otObject),
                    vertexType: constants.vertexType.connector,
                    objectType: constants.objectType.otConnector,
                    datasets: [datasetId],
                };

                vertices.push(connectorVertex);

                if (otObject.identifiers != null) {
                    otObject.identifiers.forEach((identifier) => {
                        const identifierVertex = {
                            _key: Utilities.keyFrom(
                                _type(identifier),
                                _value(identifier),
                            ),
                            identifierType: _type(identifier),
                            identifierValue: _value(identifier),
                            vertexType: constants.vertexType.identifier,
                            datasets: [datasetId],
                        };
                        vertices.push(identifierVertex);

                        // Add identity edge.
                        const identifyEdge = {
                            _key: Utilities.keyFrom(
                                dataCreator,
                                identifierVertex._key,
                                connectorVertex._key,
                            ),
                            _from: identifierVertex._key,
                            _to: connectorVertex._key,
                            relationType: constants.relationType.identifies,
                            edgeType: constants.edgeType.identifierRelation,
                            datasets: [datasetId],
                        };
                        if (identifier.autogenerated != null) {
                            identifyEdge.autogenerated = identifier.autogenerated;
                        }
                        edges.push(identifyEdge);

                        const identifiedByEdge = {
                            _key: Utilities.keyFrom(
                                dataCreator,
                                connectorVertex._key,
                                identifierVertex._key,
                            ),
                            _from: connectorVertex._key,
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
                        _key: Utilities.keyFrom(
                            dataCreator,
                            Utilities.keyFrom(otObject.properties),
                        ),
                        vertexType: constants.vertexType.data,
                        data: otObject.properties,
                        datasets: [datasetId],
                    };
                    if (encryptedMap && encryptedMap.objects &&
                            encryptedMap.objects[_id(otObject)]) {
                        dataVertex.encrypted = encryptedMap.objects[_id(otObject)];
                    }
                    vertices.push(dataVertex);

                    // Add has-data edge.
                    const hasDataEdge = {
                        _key: Utilities.keyFrom(
                            dataCreator,
                            connectorVertex._key,
                            dataVertex._key,
                        ),
                        _from: connectorVertex._key,
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
                        relationEdge._from = connectorVertex._key;
                        relationEdge._to = Utilities.keyFrom(
                            dataCreator,
                            _id(relation.linkedObject),
                        );
                        relationEdge._key = Utilities.keyFrom(
                            dataCreator,
                            relationEdge._from,
                            relationEdge._to,
                        );
                        relationEdge.edgeType = constants.edgeType.otRelation;
                        relationEdge.relationType = relation.relationType;
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

        // TODO: This is O(n^2) and should probably be optimized
        for (const vertex of vertices) {
            const obj = deduplicateVertices.find(el => el._key === vertex._key);

            if (obj == null) {
                deduplicateVertices.push(vertex);
            }
        }

        // TODO: This is O(n^2) and should probably be optimized
        for (const edge of edges) {
            const obj = deduplicateEdges.find(el => el._key === edge._key);

            if (obj == null) {
                deduplicateEdges.push(edge);
            }
        }

        const metadata = {
            _key: datasetId,
            // datasetContext: _context(document),
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
            objectIds,
        };

        await forEachSeries(vertices, vertex => this.db.addVertex(vertex));
        await forEachSeries(edges, edge => this.db.addEdge(edge));


        this.vertices = vertices;
        this.edges = edges;

        await forEachSeries(vertices.filter(vertex => vertex.vertexType === 'Connector'), async (vertex) => {
            const { identifierValue } = this.vertices.find(v => this.edges.filter(edge => edge._from === vertex._key && ['IDENTIFIED_BY'].includes(edge.relationType)).map(edge => edge._to).includes(v._key));
            const { data } = this.vertices.find(v => this.edges.filter(edge => edge._from === vertex._key && ['HAS_DATA'].includes(edge.relationType)).map(edge => edge._to).includes(v._key));
            // Connect to other connectors if available.

            const connectorIdentifierVertexKey = Utilities.keyFrom('id', identifierValue);
            const relatedConnectors = await this.db.findConnectors(connectorIdentifierVertexKey);

            await forEachSeries(
                relatedConnectors.filter(v => v._key !== vertex._key),
                async (relatedVertex) => {
                    let hasConnection1 = false;
                    if (relatedVertex.expectedConnectionCreators != null) {
                        relatedVertex.expectedConnectionCreators.forEach((expectedCreator) => {
                            const expectedErc725 = _value(expectedCreator);

                            if (dataCreator === expectedErc725) {
                                hasConnection1 = true;
                            }
                        });
                    }

                    let hasConnection2 = false;
                    await Promise.all(relatedVertex.datasets
                        .map(datasetId => new Promise(async (accept, reject) => {
                            try {
                                if (hasConnection2 === false) {
                                    const metadata = await this.db
                                        .findMetadataByImportId(datasetId);

                                    if (data.expectedConnectionCreators != null) {
                                        data.expectedConnectionCreators
                                            .forEach((expectedCreator) => {
                                                const expectedErc725 = _value(expectedCreator);

                                                if (metadata && expectedErc725 ===
                                                metadata.datasetHeader.dataCreator.identifiers
                                                    .find(x => x.identifierType === 'ERC725').identifierValue) {
                                                    hasConnection2 = true;
                                                }
                                            });
                                    }
                                }
                            } catch (e) {
                                // console.log(e);
                            } finally {
                                accept();
                            }
                        })));

                    if (!hasConnection1 || !hasConnection2) {
                        this.log.warn(`Invalid connectors (${identifierValue}).`);
                        return;
                    }

                    await this.db.addEdge({
                        _key: Utilities.keyFrom(dataCreator, vertex._key, relatedVertex._key),
                        _from: vertex._key,
                        _to: relatedVertex._key,
                        relationType: 'CONNECTION_DOWNSTREAM',
                        edgeType: 'ConnectorRelation',
                    });

                    await this.db.addEdge({
                        _key: Utilities.keyFrom(dataCreator, relatedVertex._key, vertex._key),
                        _from: relatedVertex._key,
                        _to: vertex._key,
                        relationType: 'CONNECTION_DOWNSTREAM',
                        edgeType: 'ConnectorRelation',
                    });
                },
            );
        });

        await this.db.addDatasetMetadata(metadata);

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

    /**
     * @param objectIdsArray id values of objects for which the proofs need to be generated
     * @param datasetId The dataset id to which the objects belong to
     * @returns {Promise<[]>}
     */
    async getMerkleProofs(objectIdsArray, datasetId) {
        const otjson = await this.getImport(datasetId);

        ImportUtilities.sortGraphRecursively(_graph(otjson));

        const merkleTree = ImportUtilities.createDistributionMerkleTree(
            _graph(otjson),
            datasetId,
            otjson.datasetHeader.dataCreator,
        );

        const proofs = [];

        for (const objectId of objectIdsArray) {
            const objectIndex =
                _graph(otjson).findIndex(graphObject => _id(graphObject) === objectId);

            const proof = merkleTree.createProof(objectIndex + 1);

            proofs.push({ object_id: objectId, object_index: objectIndex + 1, proof });
        }

        return proofs;
    }

    async packTrailData(data) {
        const promises = [];
        for (const object of data) {
            const { rootObject, relatedObjects } = object;

            promises.push(this._createObjectGraph(rootObject, relatedObjects));
        }

        const reconstructedObjects = await Promise.all(promises);

        const otObjects = [];

        for (let i = 0; i < reconstructedObjects.length; i += 1) {
            if (reconstructedObjects[i] && reconstructedObjects[i]['@id']) {
                otObjects.push({
                    otObject: reconstructedObjects[i],
                    datasets: data[i].rootObject.datasets,
                });
            }
        }
        return otObjects;
    }

    async _createObjectGraph(graphObject, relatedObjects) {
        const otObject = this._constructOtObject(relatedObjects);
        otObject['@id'] = graphObject.uid;
        if (graphObject.vertexType === constants.vertexType.entityObject) {
            otObject['@type'] = constants.objectType.otObject;
        } else if (graphObject.vertexType === constants.vertexType.connector) {
            otObject['@type'] = constants.objectType.otConnector;
        }

        return otObject;
    }

    _constructOtObject(relatedObjects) {
        const otObject = {};
        otObject.identifiers = [];
        otObject.relations = [];
        for (const relatedObject of relatedObjects) {
            // Check for identifiers.
            // Relation 'IDENTIFIED_BY' goes form entityVertex to identifierVertex.
            if (relatedObject.edge.edgeType === constants.edgeType.identifierRelation) {
                if (relatedObject.edge.autogenerated != null) {
                    otObject.identifiers.push({
                        '@type': relatedObject.vertex.identifierType,
                        '@value': relatedObject.vertex.identifierValue,
                        autogenerated: relatedObject.edge.autogenerated,
                    });
                } else {
                    otObject.identifiers.push({
                        '@type': relatedObject.vertex.identifierType,
                        '@value': relatedObject.vertex.identifierValue,
                    });
                }
            }

            // Check for properties.
            // Relation 'HAS_DATA' goes from entityVertex to dataVertex.
            if (relatedObject.edge.edgeType === constants.edgeType.dataRelation) {
                otObject.properties = Utilities.copyObject(relatedObject.vertex.data);
            }


            // Check for relations.
            if (relatedObject.edge.edgeType === constants.edgeType.otRelation) {
                otObject.relations.push({
                    '@type': constants.edgeType.otRelation,
                    direction: 'direct', // TODO: check this.
                    relationType: relatedObject.edge.relationType,
                    linkedObject: {
                        '@id': relatedObject.vertex.uid,
                    },
                    properties: relatedObject.edge.properties,
                });
            }
        }
        return otObject;
    }

    async _createDocumentGraph(vertices, edges) {
        const documentGraph = [];
        vertices.filter(vertex => (vertex.vertexType === constants.vertexType.entityObject))
            .forEach((entityVertex) => {
                const otObject = {
                    '@type': constants.objectType.otObject,
                    '@id': entityVertex.uid,
                    identifiers: [],
                    relations: [],
                };

                // Check for identifiers.
                // Relation 'IDENTIFIES' goes form identifierVertex to entityVertex.
                edges.filter(edge => (edge.edgeType === constants.edgeType.identifierRelation &&
                    edge._to === entityVertex._key))
                    .forEach((edge) => {
                        vertices.filter(vertices => vertices._key === edge._from)
                            .forEach((identityVertex) => {
                                if (otObject.identifiers == null) {
                                    otObject.identifiers = [];
                                }

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
                edges.filter(edge => (edge.edgeType === constants.edgeType.dataRelation
                    && edge._from === entityVertex._key))
                    .forEach((edge) => {
                        vertices.filter(vertices => vertices._key === edge._to)
                            .forEach((dataVertex) => {
                                otObject.properties = Utilities.copyObject(dataVertex.data);
                            });
                    });
                // Check for relations.
                edges.filter(edge => (edge.edgeType === constants.edgeType.otRelation
                    && edge._from === entityVertex._key))
                    .forEach((edge) => {
                        if (otObject.relations == null) {
                            otObject.relations = [];
                        }

                        // Find original vertex to get the @id.
                        const id = (vertices.filter(vertex => vertex._key === edge._to)[0]).uid;

                        otObject.relations.push({
                            '@type': constants.edgeType.otRelation,
                            direction: 'direct', // TODO: check this.
                            relationType: edge.relationType,
                            linkedObject: {
                                '@id': id,
                            },
                            properties: edge.properties,
                        });
                    });
                documentGraph.push(otObject);
            });

        vertices.filter(vertex => vertex.vertexType === constants.vertexType.connector)
            .forEach((connectorVertex) => {
                const otConnector = {
                    '@type': constants.objectType.otConnector,
                    '@id': connectorVertex.uid,
                };

                edges.filter(edge => (edge.edgeType === constants.edgeType.identifierRelation &&
                    edge._to === connectorVertex._key))
                    .forEach((edge) => {
                        vertices.filter(vertices => vertices._key === edge._from)
                            .forEach((identityVertex) => {
                                if (otConnector.identifiers == null) {
                                    otConnector.identifiers = [];
                                }

                                if (edge.autogenerated != null) {
                                    otConnector.identifiers.push({
                                        '@type': identityVertex.identifierType,
                                        '@value': identityVertex.identifierValue,
                                        autogenerated: edge.autogenerated,
                                    });
                                } else {
                                    otConnector.identifiers.push({
                                        '@type': identityVertex.identifierType,
                                        '@value': identityVertex.identifierValue,
                                    });
                                }
                            });
                    });
                // Check for properties.
                // Relation 'HAS_DATA' goes from entityVertex to dataVertex.
                edges.filter(edge => (edge.edgeType === constants.edgeType.dataRelation
                    && edge._from === connectorVertex._key))
                    .forEach((edge) => {
                        vertices.filter(vertices => vertices._key === edge._to)
                            .forEach((dataVertex) => {
                                otConnector.properties = Utilities.copyObject(dataVertex.data);
                            });
                    });
                // Check for relations.
                edges.filter(edge => (edge.edgeType === constants.edgeType.otRelation
                    && edge._from === connectorVertex._key))
                    .forEach((edge) => {
                        if (otConnector.relations == null) {
                            otConnector.relations = [];
                        }

                        // Find original vertex to get the @id.
                        const id = (vertices.filter(vertex => vertex._key === edge._to)[0]).uid;

                        otConnector.relations.push({
                            '@type': constants.edgeType.otRelation,
                            direction: 'direct', // TODO: check this.
                            relationType: edge.relationType,
                            linkedObject: {
                                '@id': id,
                            },
                            properties: edge.properties,
                        });
                    });

                documentGraph.push(otConnector);
            });

        return documentGraph;
    }

    async getImportedOtObject(datasetId, objectIndex, offerId = null, color = null) {
        // get metadata id using otObjectId
        const metadata = await this.db.findMetadataByImportId(datasetId);
        const otObjectId = metadata.objectIds[objectIndex];
        const result = await this.db.findDocumentsByImportIdAndOtObjectId(datasetId, otObjectId);

        if (!result || !result.rootObject) {
            throw Error(`Unable to find object for objectId: ${otObjectId} and importId: ${datasetId}`);
        }
        if (!result.relatedObjects || result.relatedObjects.length === 0) {
            throw Error(`Unable to find related objects for objectId: ${otObjectId} and importId: ${datasetId}`);
        }

        for (const object of result.relatedObjects) {
            if (object.vertex.vertexType === constants.vertexType.data
                && object.vertex.data != null) {
                object.vertex.data = object.vertex.encrypted[offerId][color];
            }
        }

        for (const object of result.relatedObjects) {
            if (object.edge.edgeType === constants.edgeType.otRelation
                && object.edge.properties != null) {
                object.edge.properties = object.edge.encrypted[offerId][color];
            }
        }

        const otObject = await this._createObjectGraph(result.rootObject, result.relatedObjects);

        return otObject;
    }

    /**
     * Validates the OT-JSON document's metadata to be in valid OT-JSON format.
     * @param document OT-JSON document.
     * @private
     */
    async validateDocument(document) {
        if (document == null) {
            throw Error('[Validation Error] Document cannot be null.');
        }

        if (typeof document !== 'object') {
            throw Error('[Validation Error] Document has to be object.');
        }

        if (Object.keys(document).length !== 5) {
            throw Error('[Validation Error] Lack of additional information in OT-JSON document.');
        }

        const datasetId = _id(document);
        const datasetType = _type(document);
        const { datasetHeader } = document;
        const graph = _graph(document);

        // TODO Dodati validaciju da svaki element grafa ima @id

        if (typeof datasetId !== 'string') {
            throw Error('[Validation Error] Wrong format of dataset ID');
        }

        if (datasetId !== ImportUtilities.calculateGraphHash(document['@graph'])) {
            throw Error('[Validation Error] Invalid dataset ID');
        }

        if (datasetId !== ImportUtilities.calculateGraphHash(document['@graph'])) {
            throw Error('[Validation Error] Invalid dataset ID');
        }

        if (datasetType !== 'Dataset') {
            throw Error('[Validation Error] Unsupported dataset type.');
        }

        if (graph == null || !Array.isArray(graph) || graph.length === 0) {
            throw Error('[Validation Error] Missing or empty graph.');
        }

        // TODO: Prepare support for multiple versions
        const { OTJSONVersion } = datasetHeader;
        if (OTJSONVersion !== '1.0') {
            throw Error('[Validation Error] Unsupported OT-JSON version.');
        }

        const { datasetCreationTimestamp } = datasetHeader;
        if (datasetCreationTimestamp == null &&
            !Number.isNaN(Date.parse(datasetHeader.datasetCreationTimestamp))) {
            throw Error('[Validation Error] Invalid creation date.');
        }

        const { dataCreator } = datasetHeader;
        if (dataCreator == null || dataCreator.identifiers == null) {
            throw Error('[Validation Error] Data creator is missing.');
        }

        const { identifiers } = dataCreator;
        if (!Array.isArray(identifiers) || identifiers.length !== 1) {
            throw Error('[Validation Error] Unexpected format of data creator.');
        }

        // Data creator identifier must contain ERC725 and the proper schema
        const ERCIdentifier = identifiers.find(identifierObject => (
            identifierObject.identifierType === 'ERC725'
        ));
        if (ERCIdentifier == null || typeof ERCIdentifier !== 'object' ||
            ERCIdentifier.validationSchema !== '/schemas/erc725-main' ||
            !Utilities.isHexStrict(ERCIdentifier.identifierValue)) {
            throw Error('[Validation Error] Wrong format of data creator.');
        }
        await this.schemaValidator.validateSchema(document, ERCIdentifier.validationSchema);

        this._validateRelatedEntities(graph);
    }

    /**
     * Validate that all related entities listed in the graph exist.
     * @param graph An array objects in the OT-JSON graph field.
     * @private
     */
    _validateRelatedEntities(graph) {
        const verticesIds = new Set();
        const relationsIds = new Set();

        // eslint-disable-next-line no-plusplus
        for (let i = 0; i < graph.length; i++) {
            verticesIds.add(_id(graph[i]));

            const { relations } = graph[i];
            if (relations == null) {
                // eslint-disable-next-line no-continue
                continue;
            }

            // eslint-disable-next-line no-plusplus
            for (let j = 0; j < relations.length; j++) {
                relationsIds.add(relations[j].linkedObject['@id']);
            }
        }

        relationsIds.forEach((id) => {
            if (!verticesIds.has(id)) {
                throw Error('[Validation Error] OT-JSON relations not valid');
            }
        });
    }
}

module.exports = ImportService;
