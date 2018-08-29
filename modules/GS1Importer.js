const { parseString } = require('xml2js');
const fs = require('fs');
const xsd = require('libxml-xsd');
const Utilities = require('./Utilities');

class GS1Importer {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.db = ctx.graphStorage;
        this.helper = ctx.gs1Utilities;
        this.log = ctx.logger;
    }

    async processXML(err, result) {
        const GLOBAL_R = 131317;
        const importId = Utilities.createImportId();

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
        const updates = [];

        const EDGE_KEY_TEMPLATE = 'OT_KEY_';

        const senderId = senderElement['sbdh:Identifier']._;
        const sender = {
            identifiers: {
                id: senderId,
                uid: senderElement['sbdh:Identifier']._,
            },
            data: this.helper.sanitize(senderElement['sbdh:ContactInformation'], {}, ['sbdh:']),
            vertex_type: 'SENDER',
        };
        this.helper.validateSender(sender.data);

        // Check for vocabularies.
        const vocabularyElements = this.helper.arrayze(vocabularyListElement.Vocabulary);
        for (const vocabularyElement of vocabularyElements) {
            switch (vocabularyElement.type) {
            case 'urn:ot:object:actor':
                actors = actors
                    .concat(this._parseActors(vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:object:product':
                products = products
                    .concat(this._parseProducts(vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:object:batch':
                batches = batches
                    .concat(this._parseBatches(vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:object:location':
                locations = locations
                    .concat(this._parseLocations(vocabularyElement.VocabularyElementList));
                break;
            default:
                this.helper.handleError(`Unimplemented or unknown type: ${vocabularyElement.type}.`, 400);
            }
        }

        // Check for events.
        // Types: Transport, Transformation, Observation and Ownership.
        if (eventListElement) {
            for (const objectEvent of this.helper.arrayze(eventListElement.ObjectEvent)) {
                events.push(objectEvent);
            }
            if (eventListElement.AggregationEvent) {
                const aggregationEvents = this.helper.arrayze(eventListElement.AggregationEvent);
                for (const aggregationEvent of aggregationEvents) {
                    events.push(aggregationEvent);
                }
            }

            if (eventListElement.extension && eventListElement.extension.TransformationEvent) {
                for (const transformationEvent of
                    this.helper.arrayze(eventListElement.extension.TransformationEvent)) {
                    events.push(transformationEvent);
                }
            }
        }

        // pre-fetch from DB.
        const objectClassLocationId = await this.db.getClassId('Location');
        const objectClassActorId = await this.db.getClassId('Actor');
        const objectClassProductId = await this.db.getClassId('Product');
        const objectEventTransformationId = await this.db.getClassId('Transformation');
        const objectEventObservationId = await this.db.getClassId('Observation');

        for (const location of locations) {
            const { identifiers } = location;
            Object.assign(identifiers, {
                id: location.id,
                uid: location.id,
            });

            const data = {
                object_class_id: objectClassLocationId,
            };

            this.helper.copyProperties(location.attributes, data);

            let locationKey;
            const privateData = {};

            if (location.attributes.actorId) {
                if (!locationKey) {
                    locationKey = this.helper.createKey('business_location', senderId, identifiers, data);
                }
                location.participant_id = location.attributes.actorId;
                locationEdges.push({
                    _key: this.helper.createKey('owned_by', senderId, locationKey, location.attributes.actorId),
                    _from: `${locationKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + location.attributes.actorId}`,
                    edge_type: 'OWNED_BY',
                    identifiers: {
                        uid: `owned_by_${location.id}_${location.attributes.actorId}`,
                    },
                });
            }
            if (location.extension) {
                if (location.extension.private) {
                    // eslint-disable-next-line
                    await this.helper.handlePrivate(senderId, location.id, location.extension.private, data, privateData);
                }
                if (!locationKey) {
                    locationKey = this.helper.createKey('business_location', senderId, identifiers, data);
                }
                const attrs = this.helper.parseAttributes(this.helper.arrayze(location.extension.attribute), 'urn:ot:object:location:');
                for (const attr of this.helper.arrayze(attrs)) {
                    if (attr.actorId) {
                        location.participant_id = attr.actorId;

                        locationEdges.push({
                            _key: this.helper.createKey('owned_by', senderId, locationKey, attr.actorId),
                            _from: `${locationKey}`,
                            _to: `${EDGE_KEY_TEMPLATE + attr.actorId}`,
                            edge_type: 'OWNED_BY',
                            identifiers: {
                                uid: `owned_by_${location.id}_${attr.actorId}`,
                            },
                        });
                    }
                }
            }
            if (!locationKey) {
                locationKey = this.helper.createKey('business_location', senderId, identifiers, data);
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
                const childLocationKey = this.helper.createKey('child_location', senderId, identifiers, data);
                locationVertices.push({
                    _key: childLocationKey,
                    identifiers,
                    data,
                    vertex_type: 'CHILD_LOCATION',
                });

                locationEdges.push({
                    _key: this.helper.createKey('child_location', senderId, location.id, identifiers, data),
                    _from: `${childLocationKey}`,
                    _to: `${locationKey}`,
                    edge_type: 'CHILD_LOCATION',
                    identifiers: {
                        uid: `child_location_${childId}_${location.id}`,
                    },
                });
            }
        }

        for (const actor of actors) {
            // Check for sender's wallet
            if (!senderWallet && actor.id === senderId) {
                senderWallet = actor.attributes.wallet;
            }

            const { identifiers } = actor;
            Object.assign(identifiers, {
                id: actor.id,
                uid: actor.id,
            });

            const data = {
                object_class_id: objectClassActorId,
            };

            this.helper.copyProperties(actor.attributes, data);

            const privateData = {};
            if (actor.extension) {
                if (actor.extension.private) {
                    // eslint-disable-next-line
                    await this.helper.handlePrivate(senderId, actor.id, actor.extension.private, data, privateData);
                }
            }

            actorsVertices.push({
                _key: this.helper.createKey('actor', senderId, identifiers, data),
                _id: actor.id,
                identifiers,
                data,
                private: privateData,
                vertex_type: 'ACTOR',
            });
        }

        if (senderWallet == null) {
            throw new Error('It is required for sender to have a valid wallet!');
        }

        for (const product of products) {
            const { identifiers } = product;
            Object.assign(identifiers, {
                id: product.id,
                uid: product.id,
            });

            const data = {
                object_class_id: objectClassProductId,
            };

            this.helper.copyProperties(product.attributes, data);

            const privateData = {};
            if (product.extension) {
                if (product.extension.private) {
                    // eslint-disable-next-line
                    await this.helper.handlePrivate(senderId, product.id, product.extension.private, data, privateData);
                }
            }

            productVertices.push({
                _key: this.helper.createKey('product', senderId, identifiers, data),
                _id: product.id,
                data,
                identifiers,
                private: privateData,
                vertex_type: 'PRODUCT',
            });
        }

        for (const batch of batches) {
            // eslint-disable-next-line prefer-destructuring
            const productId = batch.attributes.productId;

            const { identifiers } = batch;
            Object.assign(identifiers, {
                id: batch.id,
                uid: batch.id,
            });

            const data = {
                parent_id: productId,
            };

            this.helper.copyProperties(batch.attributes, data);

            const privateData = {};
            if (batch.extension) {
                if (batch.extension.private) {
                    // eslint-disable-next-line
                    await this.helper.handlePrivate(senderId, batch.id, batch.extension.private, data, privateData);
                }
            }

            const key = this.helper.createKey('batch', senderId, identifiers, data);
            batchesVertices.push({
                _key: key,
                identifiers,
                data,
                private: privateData,
                vertex_type: 'BATCH',
            });
        }

        // Handle events
        const batchesToExclude = [];
        for (const event of events) {
            const currentEventEdges = [];
            const currentEventVertices = [];
            const currentBatchesToRemove = [];
            const eventId = this.helper.getEventId(senderId, event);

            let eventClass;
            const { extension } = event;
            if (extension.extension) {
                eventClass = extension.extension.OTEventClass;
            } else {
                eventClass = extension.OTEventClass;
            }
            const eventCategories = this.helper.arrayze(eventClass).map(obj => this.helper.ignorePattern(obj, 'urn:ot:event:'));

            // eslint-disable-next-line
            await this.helper.zeroKnowledge(senderId, event, eventId, eventCategories,
                importId, GLOBAL_R, batchesVertices,
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
            this.helper.copyProperties(event, data);
            event.vertex_type = 'EVENT';

            let eventKey;
            const privateData = {};
            if (extension.extension) {
                if (extension.extension.private) {
                    // eslint-disable-next-line
                    await this.helper.handlePrivate(senderId, eventId, extension.extension.private, data, privateData);
                }
                eventKey = this.helper.createKey('event', senderId, identifiers, data);

                const { documentId } = extension.extension;
                if (documentId) {
                    identifiers.document_id = documentId;
                }

                const bizStep = this.helper.ignorePattern(event.bizStep, 'urn:epcglobal:cbv:bizstep:');
                const isSender = bizStep === 'shipping';

                if (extension.extension.sourceList) {
                    const sources = this.helper.arrayze(extension.extension.sourceList.source._);
                    for (const source of sources) {
                        currentEventEdges.push({
                            _key: this.helper.createKey('source', senderId, eventKey, source),
                            _from: `${eventKey}`,
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
                                currentEventEdges.push({
                                    _key: this.helper.createKey('event_connection', senderId, shippingEventVertex[0]._key, eventKey),
                                    _from: `${shippingEventVertex[0]._key}`,
                                    _to: `${eventKey}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'OUTPUT',
                                    identifiers: {
                                        uid: `event_connection_${shippingEventVertex[0].identifiers.id}_${eventId}`,
                                    },
                                });
                                currentEventEdges.push({
                                    _key: this.helper.createKey('event_connection', senderId, eventKey, shippingEventVertex[0]._key),
                                    _from: `${eventKey}`,
                                    _to: `${shippingEventVertex[0]._key}`,
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
                    destinations = this.helper.arrayze(destinations);
                    for (const destination of destinations) {
                        currentEventEdges.push({
                            _key: this.helper.createKey('destination', senderId, eventKey, destination),
                            _from: `${eventKey}`,
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
                                currentEventEdges.push({
                                    _key: this.helper.createKey('event_connection', senderId, receivingEventVertices[0]._key, eventKey),
                                    _from: `${receivingEventVertices[0]._key}`,
                                    _to: `${eventKey}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'INPUT',
                                    identifiers: {
                                        uid: `event_connection_${receivingEventVertices[0].identifiers.id}_${eventId}`,
                                    },
                                });
                                currentEventEdges.push({
                                    _key: this.helper.createKey('event_connection', senderId, eventKey, receivingEventVertices[0]._key),
                                    _from: `${eventKey}`,
                                    _to: `${receivingEventVertices[0]._key}`,
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
                eventKey = this.helper.createKey('event', senderId, identifiers, data);
            }

            const eventVertex = {
                _key: eventKey,
                data,
                identifiers,
                partner_id: event.partner_id,
                private: privateData,
                vertex_type: 'EVENT',
            };
            currentEventVertices.push(eventVertex);

            const { bizLocation } = event;
            if (bizLocation) {
                const bizLocationId = bizLocation.id;
                currentEventEdges.push({
                    _key: this.helper.createKey('at', senderId, eventKey, bizLocationId),
                    _from: `${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + bizLocationId}`,
                    edge_type: 'AT',
                    identifiers: {
                        uid: `at_${eventId}_${bizLocationId}`,
                    },
                });
            }

            if (event.readPoint) {
                const locationReadPoint = event.readPoint.id;
                currentEventEdges.push({
                    _key: this.helper.createKey('read_point', senderId, eventKey, locationReadPoint),
                    _from: `${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + event.readPoint.id}`,
                    edge_type: 'READ_POINT',
                    identifiers: {
                        uid: `read_point_${eventId}_${event.readPoint.id}`,
                    },
                });
            }

            if (event.inputEPCList) {
                for (const inputEpc of this.helper.arrayze(event.inputEPCList.epc)) {
                    const batchId = inputEpc;

                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, eventKey, batchId),
                        _from: `${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: 'INPUT_BATCH',
                        identifiers: {
                            uid: `event_batch_${eventId}_${batchId}`,
                        },
                    });
                    currentBatchesToRemove.push(batchId);
                }
            }

            if (event.epcList) {
                for (const inputEpc of this.helper.arrayze(event.epcList.epc)) {
                    const batchId = inputEpc;

                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, eventKey, batchId),
                        _from: `${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: 'EVENT_BATCH',
                        identifiers: {
                            uid: `event_batch_${eventId}_${batchId}`,
                        },
                    });
                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, batchId, eventKey),
                        _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                        _to: `${eventKey}`,
                        edge_type: 'EVENT_BATCH',
                        identifiers: {
                            uid: `event_batch_${batchId}_${eventId}`,
                        },
                    });
                    currentBatchesToRemove.push(batchId);
                }
            }

            if (event.childEPCs) {
                let edgeType;
                if (event.action === 'ADD') {
                    edgeType = 'ADDED_BATCH';
                } else if (event.action === 'DELETE') {
                    edgeType = 'REMOVED_BATCH';
                }
                for (const inputEpc of this.helper.arrayze(event.childEPCs.epc)) {
                    const batchId = inputEpc;

                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, eventKey, batchId),
                        _from: `${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: edgeType,
                        identifiers: {
                            uid: `event_batch_${eventId}_${batchId}`,
                        },
                    });
                    currentBatchesToRemove.push(batchId);
                }
            }

            if (event.parentID) {
                const { parentID } = event;

                currentEventEdges.push({
                    _key: this.helper.createKey('event_batch', senderId, eventKey, parentID),
                    _from: `${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + parentID}`,
                    edge_type: 'PALLET',
                    identifiers: {
                        uid: `event_batch_${eventId}_${parentID}`,
                    },
                });
                currentEventEdges.push({
                    _key: this.helper.createKey('event_batch', senderId, parentID, eventKey),
                    _from: `${EDGE_KEY_TEMPLATE + parentID}`,
                    _to: `${eventKey}`,
                    edge_type: 'PALLET',
                    identifiers: {
                        uid: `event_batch_${parentID}_${eventId}`,
                    },
                });
                currentBatchesToRemove.push(parentID);
            }
            if (event.outputEPCList) {
                for (const outputEpc of this.helper.arrayze(event.outputEPCList.epc)) {
                    const batchId = outputEpc;

                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, eventKey, batchId),
                        _from: `${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: 'OUTPUT_BATCH',
                        identifiers: {
                            uid: `event_batch_${eventId}_${batchId}`,
                        },
                    });
                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, batchId, eventKey),
                        _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                        _to: `${eventKey}`,
                        edge_type: 'OUTPUT_BATCH',
                        identifiers: {
                            uid: `event_batch_${batchId}_${eventId}`,
                        },
                    });
                    currentBatchesToRemove.push(batchId);
                }
            }

            let add = false;
            // eslint-disable-next-line
            const existingEventVertex = await this.db.findVertexWithMaxVersion(senderId, eventId, eventKey);
            if (existingEventVertex) {
                const { data } = eventVertex;
                const existingData = existingEventVertex.data;

                let matchPrivate = 100;
                if (existingEventVertex.data.private) {
                    matchPrivate = this._eventPrivateDistance(eventVertex, existingEventVertex);
                }

                const matchVertex = Utilities.objectDistance(data, existingData, ['quantities', 'private']);
                if (matchPrivate !== 100 || matchVertex !== 100) {
                    add = true;
                }
            } else {
                add = true;
            }
            if (add) {
                eventEdges.push(...currentEventEdges);
                eventVertices.push(...currentEventVertices);
            } else {
                for (const category of eventCategories) {
                    const key = this.helper.createKey('is', senderId, existingEventVertex._key, category);
                    updates.push(this.db.updateImports('ot_edges', key, importId));
                }

                // eslint-disable-next-line
                await Promise.all(currentEventEdges.map(async (edge) => {
                    if (edge.edge_type !== 'EVENT_CONNECTION') {
                        updates.push(this.db.updateEdgeImportsByUID(
                            senderId,
                            edge.identifiers.uid, importId,
                        ));
                    }
                }));
                // eslint-disable-next-line
                currentEventVertices.map(vertice => updates.push(this.db.updateVertexImportsByUID(senderId, vertice.identifiers.uid, importId)));
                batchesToExclude.push(...currentBatchesToRemove);
            }
        }

        for (const batchId of batchesToExclude) {
            for (const index in batchesVertices) {
                const batch = batchesVertices[index];
                if (batch.identifiers.uid === batchId) {
                    batchesVertices.splice(index, 1);
                    updates.push(updates.push(this.db.updateVertexImportsByUID(
                        senderId,
                        batch.identifiers.uid, importId,
                    )));

                    const edgeId = `batch_product_${batch.identifiers.id}_${batch.data.parent_id}`;
                    updates.push(updates.push(this.db.updateEdgeImportsByUID(
                        senderId,
                        edgeId, importId,
                    )));
                }
            }
        }

        for (const batch of batchesVertices) {
            const productId = batch.data.parent_id;

            batchEdges.push({
                _key: this.helper.createKey('batch_product', senderId, batch._key, productId),
                _from: `${batch._key}`,
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

        const classObjectEdges = [];
        eventVertices.forEach((vertex) => {
            for (const category of vertex.data.categories) {
                classObjectEdges.push({
                    _key: this.helper.createKey('is', senderId, vertex._key, category),
                    _from: `${vertex._key}`,
                    _to: `${category}`,
                    edge_type: 'IS',
                });
            }
        });

        locationVertices.forEach((vertex) => {
            classObjectEdges.push({
                _key: this.helper.createKey('is', senderId, vertex._key, objectClassLocationId),
                _from: `${vertex._key}`,
                _to: `${objectClassLocationId}`,
                edge_type: 'IS',
            });
        });

        actorsVertices.forEach((vertex) => {
            classObjectEdges.push({
                _key: this.helper.createKey('is', senderId, vertex._key, objectClassActorId),
                _from: `${vertex._key}`,
                _to: `${objectClassActorId}`,
                edge_type: 'IS',
            });
        });

        productVertices.forEach((vertex) => {
            classObjectEdges.push({
                _key: this.helper.createKey('is', senderId, vertex._key, objectClassProductId),
                _from: `${vertex._key}`,
                _to: `${objectClassProductId}`,
                edge_type: 'IS',
            });
        });

        try {
            allVertices.map((v) => {
                v.inTransaction = true;
                return v;
            });
            await Promise.all(allVertices.map(vertex => this.db.addVertex(vertex)));

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
                    if (!vertex) {
                        this.helper.handleError(`Failed to create edge with non-existent vertex ${to.substring(EDGE_KEY_TEMPLATE.length)}`, 400);
                    }
                    edge._to = `${vertex._key}`;
                }
                if (from.startsWith(EDGE_KEY_TEMPLATE)) {
                    // eslint-disable-next-line
                    const vertex = await this.db.findVertexWithMaxVersion(senderId, from.substring(EDGE_KEY_TEMPLATE.length));
                    if (!vertex) {
                        this.helper.handleError(`Failed to create edge with non-existent vertex ${to.substring(EDGE_KEY_TEMPLATE.length)}`, 400);
                    }
                    edge._from = `${vertex._key}`;
                }
            }

            allEdges.map((e) => {
                e.inTransaction = true;
                return e;
            });
            await Promise.all(allEdges.map(edge => this.db.addEdge(edge)));

            // updates
            await Promise.all(updates);
            await Promise.all(allVertices.map(vertex => this.db.updateImports('ot_vertices', vertex._key, importId)));
            await Promise.all(allEdges.map(edge => this.db.updateImports('ot_edges', edge._key, importId)));
        } catch (e) {
            this.log.warn(`Failed to import data. ${e}`);
            await this.db.rollback(); // delete elements in transaction
            throw e;
        }
        await this.db.commit();

        // console.log('Done parsing and importing.');

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

    /**
     * Import GS1 contents
     * @param contents
     * @returns {Promise}
     */
    async parseGS1(contents) {
        const xsdFileBuffer = fs.readFileSync('./importers/xsd_schemas/EPCglobal-epcis-masterdata-1_2.xsd');
        const schema = xsd.parse(xsdFileBuffer.toString());

        const validationResult = schema.validate(contents);
        if (validationResult !== null) {
            this.helper.handleError(`Failed to validate schema. ${validationResult}`, 400);
        }

        return new Promise(resolve =>
            parseString(
                contents,
                { explicitArray: false, mergeAttrs: true },
                /* eslint-disable consistent-return */
                async (err, json) => {
                    resolve(this.processXML(err, json));
                },
            ));
    }

    /**
     * Calculate distance for private data
     * @param eventVertex
     * @param existingEventVertex
     * @return {*}
     * @private
     */
    _eventPrivateDistance(eventVertex, existingEventVertex) {
        const salt = existingEventVertex.private._salt;

        const existingPrivate = {};
        this.helper.copyProperties(existingEventVertex.private, existingPrivate);
        delete existingPrivate._salt;

        const newPrivate = {};
        this.helper.copyProperties(eventVertex.private, newPrivate);
        delete newPrivate._salt;
        return this.helper.checkPrivate(
            existingEventVertex.data.private,
            newPrivate, salt,
        );
    }

    _parseLocations(vocabularyElementList) {
        const locations = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            this.helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const identifiers = this.helper.parseIdentifiers(element.attribute, 'urn:ot:object:location:');
            const childLocations = this.helper.arrayze(element.children ? element.children.id : []);

            const location = {
                type: 'location',
                id: element.id,
                identifiers,
                attributes: this.helper.parseAttributes(element.attribute, 'urn:ot:object:location:'),
                child_locations: childLocations,
                extension: element.extension,
            };
            locations.push(location);
        }
        return locations;
    }

    _parseActors(vocabularyElementList) {
        const actors = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            this.helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const identifiers = this.helper.parseIdentifiers(element.attribute, 'urn:ot:object:actor:');

            const actor = {
                type: 'actor',
                id: element.id,
                identifiers,
                attributes: this.helper.parseAttributes(element.attribute, 'urn:ot:object:actor:'),
                extension: element.extension,
            };
            actors.push(actor);
        }
        return actors;
    }

    _parseProducts(vocabularyElementList) {
        const products = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            this.helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const identifiers = this.helper.parseIdentifiers(element.attribute, 'urn:ot:object:product:');

            const product = {
                type: 'product',
                id: element.id,
                identifiers,
                attributes: this.helper.parseAttributes(element.attribute, 'urn:ot:object:product:'),
                extension: element.extension,
            };
            products.push(product);
        }
        return products;
    }

    _parseBatches(vocabularyElementList) {
        const batches = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            this.helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const identifiers = this.helper.parseIdentifiers(element.attribute, 'urn:ot:object:product:batch:');

            const batch = {
                type: 'batch',
                id: element.id,
                identifiers,
                attributes: this.helper.parseAttributes(element.attribute, 'urn:ot:object:product:batch:'),
                extension: element.extension,
            };
            batches.push(batch);
        }
        return batches;
    }
}

module.exports = GS1Importer;
