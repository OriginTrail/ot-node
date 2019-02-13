const { parseString } = require('xml2js');
const fs = require('fs');
const xsd = require('libxml-xsd');
const Utilities = require('./Utilities');
const models = require('../models');
const ImportUtilities = require('./ImportUtilities');
const { denormalizeGraph, normalizeGraph } = require('./Database/graph-converter');
const { ImporterError } = require('./errors');

class GS1Importer {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.db = ctx.graphStorage;
        this.helper = ctx.gs1Utilities;
        this.log = ctx.logger;
        this.config = ctx.config;
        this.notifyError = ctx.notifyError;
    }

    async processXML(err, result) {
        const GLOBAL_R = 131317;
        let dataSetId;
        const importId = Utilities.createImportId(this.config.node_wallet);

        const epcisDocumentElement = result['epcis:EPCISDocument'];

        // Header stuff.
        const standardBusinessDocumentHeaderElement = epcisDocumentElement.EPCISHeader['sbdh:StandardBusinessDocumentHeader'];
        const senderElement = standardBusinessDocumentHeaderElement['sbdh:Sender'];
        const vocabularyListElement =
            epcisDocumentElement.EPCISHeader.extension.EPCISMasterData.VocabularyList;
        const eventListElement = epcisDocumentElement.EPCISBody.EventList;
        let senderWallet;

        // Outputs.
        const identifiers = [];
        let locations = [];
        let actors = [];
        let products = [];
        let batches = [];
        const events = [];
        const identifierEdges = [];
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
                    // eslint-disable-next-line
                        .concat(await this._parseActors(
                        senderId, vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:object:product':
                products = products
                    // eslint-disable-next-line
                        .concat(await this._parseProducts(
                        senderId, vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:object:batch':
                batches = batches
                    // eslint-disable-next-line
                        .concat(await this._parseBatches(
                        senderId, vocabularyElement.VocabularyElementList));
                break;
            case 'urn:ot:object:location':
                locations = locations
                    // eslint-disable-next-line
                        .concat(await this._parseLocations(
                        senderId, vocabularyElement.VocabularyElementList));
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

            if (eventListElement.extension) {
                const extensions = this.helper.arrayze(eventListElement.extension);
                for (const currentExtension of extensions) {
                    events.push(currentExtension.TransformationEvent);
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
                    locationKey = this.helper.createKey('business_location', senderId, location.id);
                }
                location.participant_id = location.attributes.actorId;
                locationEdges.push({
                    _key: this.helper.createKey('owned_by', senderId, locationKey, location.attributes.actorId),
                    _from: `${locationKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + location.attributes.actorId}`,
                    edge_type: 'OWNED_BY',
                });
            }
            if (location.extension) {
                if (location.extension.private) {
                    // eslint-disable-next-line
                    await this.helper.handlePrivate(senderId, location.id, location.extension.private, data, privateData, location.private_salt);
                }
                if (!locationKey) {
                    locationKey = this.helper.createKey('business_location', senderId, location.id);
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
                        });
                    }
                }
            }
            if (!locationKey) {
                locationKey = this.helper.createKey('business_location', senderId, location.id);
            }

            locationVertices.push({
                _key: locationKey,
                identifiers,
                data,
                private: privateData,
                vertex_type: 'LOCATION',
                private_salt: location.private_salt,
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

                const childLocationKey = this.helper.createKey('business_location', senderId, childId);
                locationVertices.push({
                    _key: childLocationKey,
                    identifiers,
                    data,
                    vertex_type: 'LOCATION',
                });

                locationEdges.push({
                    _key: this.helper.createKey('child_location', senderId, location.id, identifiers, data),
                    _from: `${childLocationKey}`,
                    _to: `${locationKey}`,
                    edge_type: 'CHILD_LOCATION',
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
                    await this.helper.handlePrivate(senderId, actor.id, actor.extension.private, data, privateData, actor.private_salt);
                }
            }

            actorsVertices.push({
                _key: this.helper.createKey('actor', senderId, actor.id),
                identifiers,
                data,
                private: privateData,
                vertex_type: 'ACTOR',
                private_salt: actor.private_salt,
            });
        }

        if (senderWallet == null) {
            throw new Error('It is required for a sender to have a valid wallet!');
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
                    await this.helper.handlePrivate(senderId, product.id, product.extension.private, data, privateData, product.private_salt);
                }
            }

            productVertices.push({
                _key: this.helper.createKey('product', senderId, product.id),
                data,
                identifiers,
                private: privateData,
                vertex_type: 'PRODUCT',
                private_salt: product.private_salt,
            });
        }

        for (const batch of batches) {
            // eslint-disable-next-line prefer-destructuring
            const productId = batch.attributes.productId;

            const { identifiers, randomness } = batch;
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
                    await this.helper.handlePrivate(senderId, batch.id, batch.extension.private, data, privateData, batch.private_salt);
                }
            }

            const key = this.helper.createKey('batch', senderId, batch.id);
            batchesVertices.push({
                _key: key,
                identifiers,
                data,
                private: privateData,
                vertex_type: 'BATCH',
                randomness,
                private_salt: batch.private_salt,
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
            await this.helper.zeroKnowledge(
                senderId, event, eventId, eventCategories,
                GLOBAL_R, batchesVertices,
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

            let eventSalt = this.helper.generateSalt();

            let eventKey;
            const privateData = {};
            if (extension.extension) {
                if (extension.extension.private) {
                    // eslint-disable-next-line
                    const eventVertex = await this.db.findVertexWithMaxVersion(senderId, eventId);

                    if (eventVertex && eventVertex.private_salt) {
                        eventSalt = eventVertex.private_salt;
                    }

                    this.helper.handlePrivate(
                        senderId,
                        eventId,
                        extension.extension.private,
                        data,
                        privateData,
                        eventSalt,
                    );
                }
                eventKey = this.helper.createKey('event', senderId, eventId);

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
                        });

                        if (!isSender) {
                            // receiving
                            const filtered = locations.filter(location => location.id === source);
                            for (const location of filtered) {
                                event.partner_id = [location.participant_id];
                            }

                            // eslint-disable-next-line
                            const shippingEventVertices = await this.db.findEvent(senderId, event.partner_id, identifiers.document_id, 'shipping');
                            for (const shippingEventVertex of shippingEventVertices) {
                                currentEventEdges.push({
                                    _key: this.helper.createKey('event_connection', senderId, shippingEventVertex._key, eventKey),
                                    _from: `${shippingEventVertex._key}`,
                                    _to: `${eventKey}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'OUTPUT',
                                });
                                currentEventEdges.push({
                                    _key: this.helper.createKey('event_connection', senderId, eventKey, shippingEventVertex._key),
                                    _from: `${eventKey}`,
                                    _to: `${shippingEventVertex._key}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'INPUT',
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
                                });
                                currentEventEdges.push({
                                    _key: this.helper.createKey('event_connection', senderId, eventKey, receivingEventVertices[0]._key),
                                    _from: `${eventKey}`,
                                    _to: `${receivingEventVertices[0]._key}`,
                                    edge_type: 'EVENT_CONNECTION',
                                    transaction_flow: 'OUTPUT',
                                });
                            }
                        }
                    }
                }
            }
            if (!eventKey) {
                eventKey = this.helper.createKey('event', senderId, identifiers.id);
            }

            data.partner_id = event.partner_id;

            const eventVertex = {
                _key: eventKey,
                data,
                identifiers,
                partner_id: event.partner_id,
                private: privateData,
                vertex_type: 'EVENT',
                private_salt: eventSalt,
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
                });
            }

            if (event.readPoint) {
                const locationReadPoint = event.readPoint.id;
                currentEventEdges.push({
                    _key: this.helper.createKey('read_point', senderId, eventKey, locationReadPoint),
                    _from: `${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + event.readPoint.id}`,
                    edge_type: 'READ_POINT',
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
                    });

                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, batchId, eventKey),
                        _to: `${eventKey}`,
                        _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                        edge_type: 'INPUT_BATCH',
                    });
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
                    });
                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, batchId, eventKey),
                        _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                        _to: `${eventKey}`,
                        edge_type: 'EVENT_BATCH',
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
                });
                currentEventEdges.push({
                    _key: this.helper.createKey('event_batch', senderId, parentID, eventKey),
                    _from: `${EDGE_KEY_TEMPLATE + parentID}`,
                    _to: `${eventKey}`,
                    edge_type: 'PALLET',
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
                    });
                    currentEventEdges.push({
                        _key: this.helper.createKey('event_batch', senderId, batchId, eventKey),
                        _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                        _to: `${eventKey}`,
                        edge_type: 'OUTPUT_BATCH',
                    });
                    currentBatchesToRemove.push(batchId);
                }
            }
            eventEdges.push(...currentEventEdges);
            eventVertices.push(...currentEventVertices);
        }

        for (const batch of batchesVertices) {
            const productId = batch.data.parent_id;

            batchEdges.push({
                _key: this.helper.createKey('batch_product', senderId, batch._key, productId),
                _from: `${batch._key}`,
                _to: `${EDGE_KEY_TEMPLATE + productId}`,
                edge_type: 'IS',
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
            const sortedEvents = eventVertices.sort((a, b) => {
                if (a._key < b._key) {
                    return -1;
                }
                if (a._key > b._key) {
                    return 1;
                }
                return 0;
            });

            for (let i = 1; i < sortedEvents.length; i += 1) {
                if (sortedEvents[i]._key === sortedEvents[i - 1]._key) {
                    throw new ImporterError('Double event identifiers');
                }
            }

            for (const vertex of allVertices) {
                if (vertex.identifiers !== null) {
                    for (const identifier in vertex.identifiers) {
                        const id_type = identifier;
                        const id_value = vertex.identifiers[id_type];
                        const object_key = vertex._key;
                        const id_key = this.helper.createKey('identifier', sender, id_type, id_value);

                        if (!identifiers.find(el => el._key === id_key)) {
                            identifiers.push({
                                _key: id_key,
                                id_type,
                                id_value,
                                vertex_type: 'IDENTIFIER',
                                sender_id: senderId,
                            });
                        }

                        identifierEdges.push({
                            _key: this.helper.createKey('identifies', sender, id_key, vertex.identifiers.uid),
                            _from: id_key,
                            _to: object_key,
                            edge_type: 'IDENTIFIES',
                            sender_id: senderId,
                        });

                        identifierEdges.push({
                            _key: this.helper.createKey('identified_by', sender, vertex.identifiers.uid, id_key),
                            _from: object_key,
                            _to: id_key,
                            edge_type: 'IDENTIFIED_BY',
                            sender_id: senderId,
                        });
                    }
                }
            }

            // Adding sender ID for all edges
            const allEdges = locationEdges
                .concat(eventEdges)
                .concat(batchEdges)
                .concat(classObjectEdges)
                .concat(identifierEdges)
                .map((edge) => {
                    edge.sender_id = senderId;
                    return edge;
                });

            // Removing sender ID from EVENT_CONNECTION edges
            for (const edge of allEdges) {
                if (edge.edge_type === 'EVENT_CONNECTION') {
                    delete edge.sender_id;
                }
            }

            // Connecting edges with real vertex keys
            // TODO: Data layer refactor
            for (const edge of allEdges) {
                const to = edge._to;
                const from = edge._from;

                if (to.startsWith(EDGE_KEY_TEMPLATE)) {
                    // eslint-disable-next-line
                    const vertex = this.findVertex(allVertices, to.substring(EDGE_KEY_TEMPLATE.length));
                    if (!vertex) {
                        this.helper.handleError(`Failed to create edge with non-existent vertex ${to.substring(EDGE_KEY_TEMPLATE.length)}`, 400);
                    }
                    edge._to = `${vertex._key}`;
                }
                if (from.startsWith(EDGE_KEY_TEMPLATE)) {
                    // eslint-disable-next-line
                    const vertex = this.findVertex(allVertices, from.substring(EDGE_KEY_TEMPLATE.length));
                    if (!vertex) {
                        this.helper.handleError(`Failed to create edge with non-existent vertex ${from.substring(EDGE_KEY_TEMPLATE.length)}`, 400);
                    }
                    edge._from = `${vertex._key}`;
                }
            }

            allVertices.push(...identifiers);

            const { vertices: denormalizedVertices, edges: denormalizedEdges } = denormalizeGraph(
                importId,
                Utilities.copyObject(allVertices),
                allEdges,
            );

            const { vertices: normalizedVertices, edges: normalizedEdges } = normalizeGraph(
                importId,
                denormalizedVertices,
                denormalizedEdges,
            );

            const objectClasses = await this.db.findObjectClassVertices();
            if (objectClasses.length === 0) {
                throw Error('Missing class vertices');
            }

            const dataSetId = ImportUtilities.importHash(
                importId,
                normalizedVertices.concat(objectClasses),
                normalizedEdges,
            );

            const dataInfo = await models.data_info.find({ where: { data_set_id: dataSetId } });
            if (dataInfo) {
                throw new ImporterError(`Data set ${dataSetId} has already been imported`);
            }
            // eslint-disable-next-line
            const { vertices: newDenormalizedVertices, edges: newDenormalizedEdges } = denormalizeGraph(dataSetId, allVertices, allEdges);

            newDenormalizedVertices.map((v) => {
                v.inTransaction = true;
                return v;
            });
            await Promise.all(newDenormalizedVertices.map(vertex => this.db.addVertex(vertex)));
            newDenormalizedEdges.map((e) => {
                e.inTransaction = true;
                return e;
            });
            await Promise.all(newDenormalizedEdges.map(edge => this.db.addEdge(edge)));

            // updates
            await Promise.all(updates);
            await Promise.all(newDenormalizedVertices.map(vertex => this.db.updateImports('ot_vertices', vertex._key, dataSetId)));
            await Promise.all(newDenormalizedEdges.map((edge) => {
                if (edge.edge_type !== 'EVENT_CONNECTION') {
                    return this.db.updateImports('ot_edges', edge._key, dataSetId);
                }
                return [];
            }));

            await this.db.commit();

            normalizedVertices.map((v) => {
                delete v.inTransaction;
                return v;
            });
            normalizedEdges.map((e) => {
                delete e.inTransaction;
                return e;
            });

            return {
                vertices: normalizedVertices.concat(objectClasses),
                edges: normalizedEdges,
                data_set_id: dataSetId,
                wallet: senderWallet,
            };
        } catch (e) {
            this.log.warn(`Failed to import data. ${e}`);
            await this.db.rollback(); // delete elements in transaction
            await this.db.removeDataSetId(importId);
            throw e;
        }
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

    findVertex(vertices, vertexUID) {
        for (const vertex of vertices) {
            if (vertex.identifiers.uid === vertexUID) {
                return vertex;
            }
        }

        return null;
    }

    async _parseLocations(senderId, vocabularyElementList) {
        const locations = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            this.helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const identifiers = this.helper.parseIdentifiers(element.attribute, 'urn:ot:object:location:');
            const childLocations = this.helper.arrayze(element.children ? element.children.id : []);

            // eslint-disable-next-line
            const locationVertex = await this.db.findVertexWithMaxVersion(senderId, element.id);

            let salt = this.helper.generateSalt();

            if (locationVertex) {
                // eslint-disable-next-line
                salt = locationVertex.private_salt;
            }


            const location = {
                type: 'location',
                id: element.id,
                identifiers,
                attributes: this.helper.parseAttributes(element.attribute, 'urn:ot:object:location:'),
                child_locations: childLocations,
                extension: element.extension,
                private_salt: salt,
            };
            locations.push(location);
        }
        return locations;
    }

    async _parseActors(senderId, vocabularyElementList) {
        const actors = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            this.helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const identifiers = this.helper.parseIdentifiers(element.attribute, 'urn:ot:object:actor:');

            // eslint-disable-next-line
            const actorVertex = await this.db.findVertexWithMaxVersion(senderId, element.id);

            let salt = this.helper.generateSalt();

            if (actorVertex) {
                // eslint-disable-next-line
                salt = actorVertex.private_salt;
            }


            const actor = {
                type: 'actor',
                id: element.id,
                identifiers,
                attributes: this.helper.parseAttributes(element.attribute, 'urn:ot:object:actor:'),
                extension: element.extension,
                private_salt: salt,
            };
            actors.push(actor);
        }
        return actors;
    }

    async _parseProducts(senderId, vocabularyElementList) {
        const products = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            this.helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const identifiers = this.helper.parseIdentifiers(element.attribute, 'urn:ot:object:product:');

            // eslint-disable-next-line
            const productVertex = await this.db.findVertexWithMaxVersion(senderId, element.id);

            let salt = this.helper.generateSalt();

            if (productVertex) {
                // eslint-disable-next-line
                salt = productVertex.private_salt;
            }

            const product = {
                type: 'product',
                id: element.id,
                identifiers,
                attributes: this.helper.parseAttributes(element.attribute, 'urn:ot:object:product:'),
                extension: element.extension,
                private_salt: salt,
            };
            products.push(product);
        }
        return products;
    }

    async _parseBatches(senderId, vocabularyElementList) {
        const batches = [];

        // May be an array in VocabularyElement.
        const vocabularyElementElements =
            this.helper.arrayze(vocabularyElementList.VocabularyElement);

        for (const element of vocabularyElementElements) {
            const identifiers = this.helper.parseIdentifiers(element.attribute, 'urn:ot:object:product:batch:');

            let randomness = this.helper.zk.generateR().toString('hex');

            // eslint-disable-next-line
            const batchVertex = await this.db.findVertexWithMaxVersion(senderId, element.id);

            let salt = this.helper.generateSalt();

            if (batchVertex) {
                // eslint-disable-next-line
                randomness = batchVertex.randomness;
                salt = batchVertex.private_salt;
            }

            const batch = {
                type: 'batch',
                id: element.id,
                identifiers,
                randomness,
                attributes: this.helper.parseAttributes(element.attribute, 'urn:ot:object:product:batch:'),
                extension: element.extension,
                private_salt: salt,
            };
            batches.push(batch);
        }
        return batches;
    }
}

module.exports = GS1Importer;
