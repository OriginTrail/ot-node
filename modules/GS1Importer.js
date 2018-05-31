const { parseString } = require('xml2js');
const fs = require('fs');
const md5 = require('md5');
const xsd = require('libxml-xsd');
const Utilities = require('./Utilities');

const GS1Helper = require('./GS1Utilities');

class GS1Importer {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.db = ctx.graphStorage;
    }

    async processXML(err, result) {
        const GLOBAL_R = 131317;
        const importId = Date.now();

        const epcisDocumentElement = result['epcis:EPCISDocument'];

        // Header stuff.
        const standardBusinessDocumentHeaderElement = epcisDocumentElement.EPCISHeader['sbdh:StandardBusinessDocumentHeader'];
        const senderElement = standardBusinessDocumentHeaderElement['sbdh:Sender'];
        const vocabularyListElement =
            epcisDocumentElement.EPCISHeader.extension.EPCISMasterData.VocabularyList;
        const eventListElement = epcisDocumentElement.EPCISBody.EventList;
        let senderWallet;

        // Outputs.
        let locations = [];
        let actors = [];
        let products = [];
        let batches = [];
        const events = [];
        const eventEdges = [];
        const locationEdges = [];
        const locationVertices = [];
        const actorsVertices = [];
        const productVertices = [];
        const batchEdges = [];
        const batchesVertices = [];
        const eventVertices = [];

        const EDGE_KEY_TEMPLATE = 'ot_vertices/OT_KEY_';

        const senderId = senderElement['sbdh:Identifier']._;
        const sender = {
            identifiers: {
                id: senderId,
                uid: senderElement['sbdh:Identifier']._,
            },
            data: GS1Helper.sanitize(senderElement['sbdh:ContactInformation'], {}, ['sbdh:']),
            vertex_type: 'SENDER',
        };
        GS1Helper.validateSender(sender.data);

        // Check for vocabularies.
        const vocabularyElements = GS1Helper.arrayze(vocabularyListElement.Vocabulary);

        for (const vocabularyElement of vocabularyElements) {
            switch (vocabularyElement.type) {
            case 'urn:ot:mda:actor':
                actors = actors
                    .concat(GS1Importer._parseActors(vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:mda:product':
                products = products
                    .concat(GS1Importer._parseProducts(vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:mda:batch':
                batches = batches
                    .concat(GS1Importer._parseBatches(vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:mda:location':
                locations = locations
                    .concat(GS1Importer._parseLocations(vocabularyElement.VocabularyElementList));
                break;
            default:
                throw Error(`Unimplemented or unknown type: ${vocabularyElement.type}.`);
            }
        }

        // Check for events.
        // Types: Transport, Transformation, Observation and Ownership.
        for (const objectEvent of GS1Helper.arrayze(eventListElement.ObjectEvent)) {
            events.push(objectEvent);
        }

        if (eventListElement.AggregationEvent) {
            for (const aggregationEvent of GS1Helper.arrayze(eventListElement.AggregationEvent)) {
                events.push(aggregationEvent);
            }
        }

        if (eventListElement.extension && eventListElement.extension.TransformationEvent) {
            for (const transformationEvent of
                GS1Helper.arrayze(eventListElement.extension.TransformationEvent)) {
                events.push(transformationEvent);
            }
        }

        // pre-fetch from DB.
        const objectClassLocationId = await this.db.getClassId('Location');
        const objectClassActorId = await this.db.getClassId('Actor');
        const objectClassProductId = await this.db.getClassId('Product');
        const objectEventTransformationId = await this.db.getClassId('Transformation');
        const objectEventObservationId = await this.db.getClassId('Observation');

        for (const location of locations) {
            const identifiers = {
                id: location.id,
                uid: location.id,
            };
            const data = {
                object_class_id: objectClassLocationId,
            };

            GS1Helper.copyProperties(location.attributes, data);

            const privateData = {};
            let locationKey;
            if (location.extension) {
                if (location.extension.private) {
                    data.private = {};
                    for (const key in location.extension.private) {
                        const value = location.extension.private[key];
                        privateData[key] = value;
                        data.private[key] = Utilities.sha3(JSON.stringify(`${value}`));
                    }
                }
                locationKey = md5(`business_location_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);
                const attrs = GS1Helper.parseAttributes(GS1Helper.arrayze(location.extension.attribute), 'urn:ot:location:');
                for (const attr of GS1Helper.arrayze(attrs)) {
                    if (attr.participantId) {
                        location.participant_id = attr.participantId;

                        locationEdges.push({
                            _key: md5(`owned_by_${senderId}_${locationKey}_${attr.participantId}`),
                            _from: `ot_vertices/${locationKey}`,
                            _to: `${EDGE_KEY_TEMPLATE + attr.participantId}`,
                            edge_type: 'OWNED_BY',
                            identifiers: {
                                uid: `owned_by_${location.id}_${attr.participantId}`,
                            },
                        });
                    }
                }
            }
            if (!locationKey) {
                locationKey = md5(`business_location_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);
            }

            locationVertices.push({
                _key: locationKey,
                identifiers,
                data,
                private: privateData,
                vertex_type: 'LOCATION',
            });

            const { child_locations } = location;
            for (const childId of child_locations) {
                const identifiers = {
                    id: childId,
                    uid: childId,
                };
                const data = {
                    parent_id: location.id,
                };

                const childLocationKey = md5(`child_business_location_${senderId}_${md5(JSON.stringify(identifiers))}_${md5(JSON.stringify(data))}`);
                locationVertices.push({
                    _key: childLocationKey,
                    identifiers,
                    data,
                    vertex_type: 'CHILD_BUSINESS_LOCATION',
                });

                locationEdges.push({
                    _key: md5(`child_business_location_${senderId}_${location.id}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`),
                    _from: `ot_vertices/${childLocationKey}`,
                    _to: `ot_vertices/${locationKey}`,
                    edge_type: 'CHILD_BUSINESS_LOCATION',
                    identifiers: {
                        uid: `child_business_location_${childId}_${location.id}`,
                    },
                });
            }
        }

        for (const actor of actors) {
            // Check for sender's wallet
            if (!senderWallet && actor.id === senderId) {
                senderWallet = actor.attributes.wallet;
            }

            const identifiers = {
                id: actor.id,
                uid: actor.id,
            };

            const data = {
                object_class_id: objectClassActorId,
            };

            GS1Helper.copyProperties(actor.attributes, data);

            const privateData = {};
            if (actor.extension) {
                if (actor.extension.private) {
                    data.private = {};
                    for (const key in actor.extension.private) {
                        const value = actor.extension.private[key];
                        privateData[key] = value;
                        data.private[key] = Utilities.sha3(JSON.stringify(`${value}`));
                    }
                }
            }

            actorsVertices.push({
                _key: md5(`actor_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`),
                _id: actor.id,
                identifiers,
                data,
                private: privateData,
                vertex_type: 'ACTOR',
            });
        }

        for (const product of products) {
            const identifiers = {
                id: product.id,
                uid: product.id,
            };

            const data = {
                object_class_id: objectClassProductId,
            };

            GS1Helper.copyProperties(product.attributes, data);

            const privateData = {};
            if (product.extension) {
                if (product.extension.private) {
                    data.private = {};
                    for (const key in product.extension.private) {
                        const value = product.extension.private[key];
                        privateData[key] = value;
                        data.private[key] = Utilities.sha3(JSON.stringify(`${value}`));
                    }
                }
            }

            productVertices.push({
                _key: md5(`product_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`),
                _id: product.id,
                data,
                identifiers,
                private: privateData,
                vertex_type: 'PRODUCT',
            });
        }

        for (const batch of batches) {
            const productId = batch.attributes.productid;

            const identifiers = {
                id: batch.id,
                uid: batch.id,
            };

            const data = {
                parent_id: productId,
            };

            GS1Helper.copyProperties(batch.attributes, data);

            const privateData = {};
            if (batch.extension) {
                if (batch.extension.private) {
                    data.private = {};
                    for (const key in batch.extension.private) {
                        const value = batch.extension.private[key];
                        privateData[key] = value;
                        data.private[key] = Utilities.sha3(JSON.stringify(`${value}`));
                    }
                }
            }

            const key = md5(`batch_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);
            batchesVertices.push({
                _key: key,
                identifiers: {
                    id: batch.id,
                    uid: batch.id,
                },
                data,
                private: privateData,
                vertex_type: 'BATCH',
            });
        }

        // Handle events
        const batchesToRemove = [];
        for (const event of events) {
            const tmpEventEdges = [];
            const tmpEventVertices = [];
            const tmpBatchesToRemove = [];

            const eventId = GS1Helper.getEventId(senderId, event);

            const { extension } = event;

            let eventCategories;
            if (extension.extension) {
                const eventClass = extension.extension.OTEventClass;
                eventCategories = GS1Helper.arrayze(eventClass).map(obj => GS1Helper.ignorePattern(obj, 'ot:events:'));
            } else {
                const eventClass = extension.OTEventClass;
                eventCategories = GS1Helper.arrayze(eventClass).map(obj => GS1Helper.ignorePattern(obj, 'ot:event:'));
            }

            // eslint-disable-next-line
            await GS1Helper.zeroKnowledge(senderId, event, eventId, eventCategories,
                importId, GLOBAL_R, batchesVertices, this.db,
            );

            const identifiers = {
                id: eventId,
                uid: eventId,
            };

            let classId = null;
            if (event.action && event.action === 'OBSERVE') {
                classId = objectEventObservationId;
            } else {
                classId = objectEventTransformationId; // TODO map to class ID
            }

            const data = {
                object_class_id: classId,
                categories: eventCategories,
            };
            GS1Helper.copyProperties(event, data);
            event.vertex_type = 'EVENT';

            let eventKey;
            const privateData = {};
            if (extension.extension) {
                if (extension.extension.private) {
                    data.private = {};
                    for (const key in extension.extension.private) {
                        const value = extension.extension.private[key];
                        privateData[key] = value;
                        data.private[key] = Utilities.sha3(JSON.stringify(`${value}`));
                    }
                }
                eventKey = md5(`event_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);

                const { documentId } = extension.extension;
                if (documentId) {
                    identifiers.document_id = documentId;
                }

                const bizStep = GS1Helper.ignorePattern(event.bizStep, 'urn:epcglobal:cbv:bizstep:');
                const isSender = bizStep === 'shipping';

                if (extension.extension.sourceList) {
                    const sources = GS1Helper.arrayze(extension.extension.sourceList.source._);
                    for (const source of sources) {
                        tmpEventEdges.push({
                            _key: md5(`source_${senderId}_${eventKey}_${source}`),
                            _from: `ot_vertices/${eventKey}`,
                            _to: `${EDGE_KEY_TEMPLATE + source}`,
                            edge_type: 'SOURCE',
                            identifiers: {
                                uid: `source_${eventId}_${source}`,
                            },
                        });

                        if (!isSender) {
                            // receiving
                            const filtered = locations.filter(location => location.id === source);
                            for (const location of filtered) {
                                event.partner_id = [location.participant_id];
                            }

                            // eslint-disable-next-line
                            const shippingEventVertex = await this.db.findEvent(senderId, event.partner_id, identifiers.document_id, 'shipping');
                            if (shippingEventVertex.length > 0) {
                                tmpEventEdges.push({
                                    _key: md5(`event_connection_${senderId}_${shippingEventVertex[0]._key}_${eventKey}`),
                                    _from: `ot_vertices/${shippingEventVertex[0]._key}`,
                                    _to: `ot_vertices/${eventKey}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'OUTPUT',
                                    identifiers: {
                                        uid: `event_connection_${shippingEventVertex[0].identifiers.id}_${eventId}`,
                                    },
                                });
                                tmpEventEdges.push({
                                    _key: md5(`event_connection_${senderId}_${eventKey}_${shippingEventVertex[0]._key}`),
                                    _from: `ot_vertices/${eventKey}`,
                                    _to: `ot_vertices/${shippingEventVertex[0]._key}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'INPUT',
                                    identifiers: {
                                        uid: `event_connection_${eventId}_${shippingEventVertex[0].identifiers.id}`,
                                    },
                                });
                            }
                        }
                    }
                }

                if (extension.extension.destinationList) {
                    let destinations = extension.extension.destinationList.destination._;
                    destinations = GS1Helper.arrayze(destinations);
                    for (const destination of destinations) {
                        tmpEventEdges.push({
                            _key: md5(`destination_${senderId}_${eventKey}_${destination}`),
                            _from: `ot_vertices/${eventKey}`,
                            _to: `${EDGE_KEY_TEMPLATE + destination}`,
                            edge_type: 'DESTINATION',
                            identifiers: {
                                uid: `destination_${eventId}_${destination}`,
                            },
                        });

                        if (isSender) {
                            // shipping
                            const filtered =
                                locations.filter(location => location.id === destination);
                            for (const location of filtered) {
                                event.partner_id = [location.participant_id];
                            }

                            // eslint-disable-next-line
                            const receivingEventVertices = await this.db.findEvent(senderId, event.partner_id, identifiers.document_id, 'receiving');
                            if (receivingEventVertices.length > 0) {
                                tmpEventEdges.push({
                                    _key: md5(`event_connection_${senderId}_${receivingEventVertices[0]._key}_${eventKey}`),
                                    _from: `ot_vertices/${receivingEventVertices[0]._key}`,
                                    _to: `ot_vertices/${eventKey}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'INPUT',
                                    identifiers: {
                                        uid: `event_connection_${receivingEventVertices[0].identifiers.id}_${eventId}`,
                                    },
                                });
                                tmpEventEdges.push({
                                    _key: md5(`event_connection_${senderId}_${eventKey}_${receivingEventVertices[0]._key}`),
                                    _from: `ot_vertices/${eventKey}`,
                                    _to: `ot_vertices/${receivingEventVertices[0]._key}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'OUTPUT',
                                    identifiers: {
                                        uid: `event_connection_${eventId}_${receivingEventVertices[0].identifiers.id}`,
                                    },
                                });
                            }
                        }
                    }
                }
            }
            if (!eventKey) {
                eventKey = md5(`event_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);
            }

            const eventVertex = {
                _key: eventKey,
                data,
                identifiers,
                partner_id: event.partner_id,
                private: privateData,
                vertex_type: 'EVENT',
            };
            tmpEventVertices.push(eventVertex);

            const { bizLocation } = event;
            if (bizLocation) {
                const bizLocationId = bizLocation.id;
                tmpEventEdges.push({
                    _key: md5(`at_${senderId}_${eventKey}_${bizLocationId}`),
                    _from: `ot_vertices/${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + bizLocationId}`,
                    edge_type: 'AT',
                    identifiers: {
                        uid: `at_${eventId}_${bizLocationId}`,
                    },
                });
            }

            if (event.readPoint) {
                const locationReadPoint = event.readPoint.id;
                tmpEventEdges.push({
                    _key: md5(`read_point_${senderId}_${eventKey}_${locationReadPoint}`),
                    _from: `ot_vertices/${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + event.readPoint.id}`,
                    edge_type: 'READ_POINT',
                    identifiers: {
                        uid: `read_point_${eventId}_${event.readPoint.id}`,
                    },
                });
            }

            if (event.inputEPCList) {
                for (const inputEpc of GS1Helper.arrayze(event.inputEPCList.epc)) {
                    const batchId = inputEpc;

                    tmpEventEdges.push({
                        _key: md5(`event_batch_${senderId}_${eventKey}_${batchId}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: 'INPUT_BATCH',
                        identifiers: {
                            uid: `event_batch_${eventId}_${batchId}`,
                        },
                    });
                    tmpBatchesToRemove.push(batchId);
                }
            }

            if (event.epcList) {
                for (const inputEpc of GS1Helper.arrayze(event.epcList.epc)) {
                    const batchId = inputEpc;

                    tmpEventEdges.push({
                        _key: md5(`event_batch_${senderId}_${eventKey}_${batchId}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: 'EVENT_BATCH',
                        identifiers: {
                            uid: `event_batch_${eventId}_${batchId}`,
                        },
                    });
                    tmpEventEdges.push({
                        _key: md5(`event_batch_${senderId}_${batchId}_${eventKey}`),
                        _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                        _to: `ot_vertices/${eventKey}`,
                        edge_type: 'EVENT_BATCH',
                        identifiers: {
                            uid: `event_batch_${batchId}_${eventId}`,
                        },
                    });
                    tmpBatchesToRemove.push(batchId);
                }
            }

            if (event.childEPCs) {
                for (const inputEpc of GS1Helper.arrayze(event.childEPCs)) {
                    const batchId = inputEpc.epc;

                    tmpEventEdges.push({
                        _key: md5(`event_batch_${senderId}_${eventKey}_${batchId}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: 'CHILD_BATCH',
                        identifiers: {
                            uid: `event_batch_${eventId}_${batchId}`,
                        },
                    });
                    tmpBatchesToRemove.push(batchId);
                }
            }

            if (event.outputEPCList) {
                for (const outputEpc of GS1Helper.arrayze(event.outputEPCList.epc)) {
                    const batchId = outputEpc;

                    tmpEventEdges.push({
                        _key: md5(`event_batch_${senderId}_${eventKey}_${batchId}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: 'OUTPUT_BATCH',
                        identifiers: {
                            uid: `event_batch_${eventId}_${batchId}`,
                        },
                    });
                    tmpEventEdges.push({
                        _key: md5(`event_batch_${senderId}_${batchId}_${eventKey}`),
                        _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                        _to: `ot_vertices/${eventKey}`,
                        edge_type: 'OUTPUT_BATCH',
                        identifiers: {
                            uid: `event_batch_${batchId}_${eventId}`,
                        },
                    });
                    tmpBatchesToRemove.push(batchId);
                }
            }

            // eslint-disable-next-line
            const existingEventVertex = await this.db.findVertexWithMaxVersion(senderId, eventId, eventKey);
            let add = false;
            if (existingEventVertex) {
                const { data } = eventVertex;
                const existingData = existingEventVertex.data;

                const match = Utilities.objectDistance(data, existingData, ['quantities']);
                if (match !== 100) {
                    add = true;
                }
            } else {
                add = true;
            }
            if (add) {
                eventEdges.push(...tmpEventEdges);
                eventVertices.push(...tmpEventVertices);
            } else {
                const updates = [];
                for (const category of eventCategories) {
                    updates.push(this.db.updateEdgeImportsByUID(senderId, `event_batch_${eventId}_${category}`, importId));
                }
                // eslint-disable-next-line
                await Promise.all(updates);

                // eslint-disable-next-line
                await Promise.all(tmpEventEdges.map(async (edge) => {
                    if (edge.edge_type !== 'EVENT_CONNECTION') {
                        await this.db
                            .updateEdgeImportsByUID(senderId, edge.identifiers.uid, importId);
                    }
                }));
                // eslint-disable-next-line
                await Promise.all(tmpEventVertices.map(vertice => this.db.updateVertexImportsByUID(senderId, vertice.identifiers.uid, importId)));
                batchesToRemove.push(...tmpBatchesToRemove);
            }
        }

        const updateBatchImports = [];
        const updateBatchProductImports = [];
        for (const batchId of batchesToRemove) {
            for (const index in batchesVertices) {
                const batch = batchesVertices[index];
                if (batch.identifiers.uid === batchId) {
                    batchesVertices.splice(index, 1);
                    updateBatchImports.push(batch.identifiers.uid);
                    updateBatchProductImports.push(`batch_product_${batch.identifiers.id}_${batch.data.parent_id}`);
                }
            }
        }
        await Promise.all(updateBatchImports.map(vertexId =>
            this.db.updateVertexImportsByUID(senderId, vertexId, importId)));
        await Promise.all(updateBatchProductImports.map(edgeId =>
            this.db.updateEdgeImportsByUID(senderId, edgeId, importId)));

        for (const batch of batchesVertices) {
            const productId = batch.data.parent_id;

            batchEdges.push({
                _key: md5(`batch_product_${senderId}_${batch._key}_${productId}`),
                _from: `ot_vertices/${batch._key}`,
                _to: `${EDGE_KEY_TEMPLATE + productId}`,
                edge_type: 'IS',
                identifiers: {
                    uid: `batch_product_${batch.identifiers.id}_${productId}`,
                },
            });
        }

        const allVertices =
            locationVertices
                .concat(actorsVertices)
                .concat(productVertices)
                .concat(batchesVertices)
                .concat(eventVertices)
                .map((vertex) => {
                    vertex.sender_id = senderId;
                    return vertex;
                });

        const promises = allVertices.map(vertex => this.db.addVertex(vertex));
        await Promise.all(promises);

        const classObjectEdges = [];

        eventVertices.forEach((vertex) => {
            for (const category of vertex.data.categories) {
                eventVertices.forEach((vertex) => {
                    classObjectEdges.push({
                        _key: md5(`is_${senderId}_${vertex.id}_${category}`),
                        _from: `ot_vertices/${vertex._key}`,
                        _to: `ot_vertices/${category}`,
                        edge_type: 'IS',
                        identifiers: {
                            uid: `event_batch_${vertex.identifiers.uid}_${category}`,
                        },
                    });
                });
            }
        });

        locationVertices.forEach((vertex) => {
            classObjectEdges.push({
                _key: md5(`is_${senderId}_${vertex._key}_${objectClassLocationId}`),
                _from: `ot_vertices/${vertex._key}`,
                _to: `ot_vertices/${objectClassLocationId}`,
                edge_type: 'IS',
            });
        });

        actorsVertices.forEach((vertex) => {
            classObjectEdges.push({
                _key: md5(`is_${senderId}_${vertex._key}_${objectClassActorId}`),
                _from: `ot_vertices/${vertex._key}`,
                _to: `ot_vertices/${objectClassActorId}`,
                edge_type: 'IS',
            });
        });

        productVertices.forEach((vertex) => {
            classObjectEdges.push({
                _key: md5(`is_${senderId}_${vertex._key}_${objectClassProductId}`),
                _from: `ot_vertices/${vertex._key}`,
                _to: `ot_vertices/${objectClassProductId}`,
                edge_type: 'IS',
            });
        });

        eventVertices.forEach((vertex) => {
            vertex.data.categories.forEach(async (category) => {
                const classKey = await this.db.getClassId(category);
                classObjectEdges.push({
                    _key: md5(`is_${senderId}_${vertex._key}_${classKey}`),
                    _from: `ot_vertices/${vertex._key}`,
                    _to: `ot_vertices/${classKey}`,
                    edge_type: 'IS',
                });
            });
        });

        const allEdges = locationEdges
            .concat(eventEdges)
            .concat(batchEdges)
            .concat(classObjectEdges)
            .map((edge) => {
                edge.sender_id = senderId;
                return edge;
            });

        for (const edge of allEdges) {
            const to = edge._to;
            const from = edge._from;

            if (to.startsWith(EDGE_KEY_TEMPLATE)) {
                // eslint-disable-next-line
                const vertex = await this.db.findVertexWithMaxVersion(senderId, to.substring(EDGE_KEY_TEMPLATE.length));
                edge._to = `ot_vertices/${vertex._key}`;
            }
            if (from.startsWith(EDGE_KEY_TEMPLATE)) {
                // eslint-disable-next-line
                const vertex = await this.db.findVertexWithMaxVersion(senderId, from.substring(EDGE_KEY_TEMPLATE.length));
                edge._from = `ot_vertices/${vertex._key}`;
            }
        }
        await Promise.all(allEdges.map(edge => this.db.addEdge(edge)));

        await Promise.all(allVertices.map(vertex => this.db.updateImports('ot_vertices', vertex._key, importId)));
        await Promise.all(allEdges.map(edge => this.db.updateImports('ot_edges', edge._key, importId)));

        console.log('Done parsing and importing.');

        let edgesPerImport = await this.db.findEdgesByImportId(importId);
        edgesPerImport = edgesPerImport.filter(edge => edge.edge_type !== 'EVENT_CONNECTION');
        edgesPerImport = edgesPerImport.map((edge) => {
            delete edge.private;
            return edge;
        });

        let verticesPerImport = await this.db.findVerticesByImportId(importId);
        verticesPerImport = verticesPerImport.map((vertex) => {
            delete vertex.private;
            return vertex;
        });
        return {
            vertices: verticesPerImport,
            edges: edgesPerImport,
            import_id: importId,
            wallet: senderWallet,
        };
    }

    async parseGS1(gs1XmlFile) {
        const gs1XmlFileBuffer = fs.readFileSync(gs1XmlFile);
        const xsdFileBuffer = fs.readFileSync('./importers/EPCglobal-epcis-masterdata-1_2.xsd');
        const schema = xsd.parse(xsdFileBuffer.toString());

        const validationResult = schema.validate(gs1XmlFileBuffer.toString());
        if (validationResult !== null) {
            throw Error(`Failed to validate schema. ${validationResult}`);
        }

        return new Promise(resolve =>
            parseString(
                gs1XmlFileBuffer,
                { explicitArray: false, mergeAttrs: true },
                /* eslint-disable consistent-return */
                async (err, json) => {
                    resolve(this.processXML(err, json));
                },
            ));
    }

    static _parseLocations(vocabularyElementList) {
        const locations = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            GS1Helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const childLocations = GS1Helper.arrayze(element.children ? element.children.id : []);

            const location = {
                type: 'location',
                id: element.id,
                attributes: GS1Helper.parseAttributes(element.attribute, 'urn:ot:mda:location:'),
                child_locations: childLocations,
                extension: element.extension,
            };
            locations.push(location);
        }
        return locations;
    }

    static _parseActors(vocabularyElementList) {
        const actors = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            GS1Helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const actor = {
                type: 'actor',
                id: element.id,
                attributes: GS1Helper.parseAttributes(element.attribute, 'urn:ot:mda:actor:'),
                extension: element.extension,
            };
            actors.push(actor);
        }
        return actors;
    }

    static _parseProducts(vocabularyElementList) {
        const products = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            GS1Helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const product = {
                type: 'product',
                id: element.id,
                attributes: GS1Helper.parseAttributes(element.attribute, 'urn:ot:mda:product:'),
                extension: element.extension,
            };
            products.push(product);
        }
        return products;
    }

    static _parseBatches(vocabularyElementList) {
        const batches = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            GS1Helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const batch = {
                type: 'batch',
                id: element.id,
                attributes: GS1Helper.parseAttributes(element.attribute, 'urn:ot:mda:batch:'),
                extension: element.extension,
            };
            batches.push(batch);
        }
        return batches;
    }
}

module.exports = GS1Importer;
