const { parseString } = require('xml2js');
const fs = require('fs');
const md5 = require('md5');
const xsd = require('libxml-xsd');

const ZK = require('./ZK');

const zk = new ZK();
const GSInstance = require('./GraphStorageInstance');
const validator = require('validator');

function sanitize(old_obj, new_obj, patterns) {
    if (typeof old_obj !== 'object') { return old_obj; }

    for (const key in old_obj) {
        let new_key = key;
        for (const i in patterns) {
            new_key = new_key.replace(patterns[i], '');
        }
        new_obj[new_key] = sanitize(old_obj[key], {}, patterns);
    }
    return new_obj;
}

// validate
function emailValidation(email) {
    const result = validator.isEmail(email);
    return !!result;
}

function dateTimeValidation(date) {
    const result = validator.isISO8601(date);
    return !!result;
}

function arrayze(value) {
    if (value) {
        return [].concat(value);
    }
    return [];
}

function copyProperties(from, to) {
    for (const property in from) {
        to[property] = from[property];
    }
}

function parseAttributes(attributes, ignorePattern) {
    const output = {};
    const inputAttributeArray = arrayze(attributes);

    for (const inputElement of inputAttributeArray) {
        output[inputElement.id.replace(ignorePattern, '')] = inputElement._;
    }

    return output;
}

function ignorePattern(attribute, ignorePattern) {
    return attribute.replace(ignorePattern, '');
}

function parseLocations(vocabularyElementList) {
    const locations = [];

    // May be an array in VocabularyElement.
    const vocabularyElementElements = arrayze(vocabularyElementList.VocabularyElement);

    for (const element of vocabularyElementElements) {
        const childLocations = arrayze(element.children ? element.children.id : []);

        const location = {
            type: 'location',
            id: element.id,
            attributes: parseAttributes(element.attribute, 'urn:ot:mda:location:'),
            child_locations: childLocations,
            extension: element.extension,
        };

        locations.push(location);
    }

    return locations;
}

function parseActors(vocabularyElementList) {
    const actors = [];

    // May be an array in VocabularyElement.
    const vocabularyElementElements = arrayze(vocabularyElementList.VocabularyElement);

    for (const element of vocabularyElementElements) {
        const actor = {
            type: 'actor',
            id: element.id,
            attributes: parseAttributes(element.attribute, 'urn:ot:mda:actor:'),
        };

        actors.push(actor);
    }

    return actors;
}

function parseProducts(vocabularyElementList) {
    const products = [];

    // May be an array in VocabularyElement.
    const vocabularyElementElements = arrayze(vocabularyElementList.VocabularyElement);

    for (const element of vocabularyElementElements) {
        const product = {
            type: 'product',
            id: element.id,
            attributes: parseAttributes(element.attribute, 'urn:ot:mda:product:'),
        };

        products.push(product);
    }

    return products;
}

function parseBatches(vocabularyElementList) {
    const batches = [];

    // May be an array in VocabularyElement.
    const vocabularyElementElements = arrayze(vocabularyElementList.VocabularyElement);

    for (const element of vocabularyElementElements) {
        const batch = {
            type: 'batch',
            id: element.id,
            attributes: parseAttributes(element.attribute, 'urn:ot:mda:batch:'),
        };

        batches.push(batch);
    }

    return batches;
}

/**
 * Zero knowledge processing
 * @param senderId
 * @param event
 * @param eventId
 * @param categories
 * @param importId
 * @param globalR
 * @param batchVertices
 * @return {Promise<void>}
 */
async function zeroKnowledge(
    senderId, event, eventId, categories,
    importId, globalR, batchVertices, db,
) {
    let inputQuantities = [];
    let outputQuantities = [];
    const { extension } = event;
    if (categories.includes('Ownership') || categories.includes('Transport') ||
        categories.includes('Observation')) {
        const bizStep = ignorePattern(event.bizStep, 'urn:epcglobal:cbv:bizstep:');

        const { quantityList } = extension;
        if (bizStep === 'shipping') {
            // sending input
            if (categories.includes('Ownership')) {
                outputQuantities = arrayze(quantityList.quantityElement)
                    .map(elem => ({
                        object: elem.epcClass,
                        quantity: parseInt(elem.quantity, 10),
                        r: globalR,
                    }));
            } else {
                outputQuantities = arrayze(quantityList.quantityElement)
                    .map(elem => ({
                        object: elem.epcClass,
                        quantity: parseInt(elem.quantity, 10),
                    }));
            }

            for (const outputQ of outputQuantities) {
                // eslint-disable-next-line
                const vertex = await db.findVertexWithMaxVersion(senderId, outputQ.object);
                if (vertex) {
                    const quantities = vertex.data.quantities.private;
                    const quantity = {
                        object: outputQ.object,
                        quantity: parseInt(quantities.quantity, 10),
                        r: quantities.r,
                    };
                    inputQuantities.push(quantity);
                } else {
                    inputQuantities.push({
                        added: true,
                        object: outputQ.object,
                        quantity: parseInt(outputQ.quantity, 10),
                    });
                }
            }
        } else {
            // receiving output
            if (categories.includes('Ownership')) {
                inputQuantities = arrayze(quantityList.quantityElement).map(elem => ({
                    object: elem.epcClass,
                    quantity: parseInt(elem.quantity, 10),
                    r: globalR,
                }));
            } else {
                inputQuantities = arrayze(quantityList.quantityElement).map(elem => ({
                    object: elem.epcClass,
                    quantity: parseInt(elem.quantity, 10),
                }));
            }

            for (const inputQ of inputQuantities) {
                // eslint-disable-next-line
                const vertex = await db.findVertexWithMaxVersion(senderId, inputQ.object);
                if (vertex) {
                    const quantities = vertex.data.quantities.private;
                    outputQuantities.push({
                        object: inputQ.object,
                        quantity: parseInt(quantities.quantity, 10),
                        r: quantities.r,
                    });
                } else {
                    outputQuantities.push({
                        added: true,
                        object: inputQ.object,
                        quantity: parseInt(inputQ.quantity, 10),
                    });
                }
            }
        }
    } else {
        // Transformation
        const { inputQuantityList, outputQuantityList } = event;
        if (inputQuantityList) {
            const tmpInputQuantities = arrayze(inputQuantityList.quantityElement).map(elem => ({
                object: elem.epcClass,
                quantity: parseInt(elem.quantity, 10),
                r: globalR,
            }));
            for (const inputQuantity of tmpInputQuantities) {
                // eslint-disable-next-line
                const vertex = await db.findVertexWithMaxVersion(senderId, inputQuantity.object);
                if (vertex) {
                    const quantities = vertex.data.quantities.private;
                    const quantity = {
                        object: inputQuantity.object,
                        quantity: parseInt(quantities.quantity, 10),
                        r: quantities.r,
                    };
                    inputQuantities.push(quantity);
                } else {
                    inputQuantities.push({
                        added: true,
                        object: inputQuantity.object,
                        quantity: parseInt(inputQuantity.quantity, 10),
                    });
                }
            }
        }
        if (outputQuantityList) {
            const tmpOutputQuantities = arrayze(outputQuantityList.quantityElement)
                .map(elem => ({
                    object: elem.epcClass,
                    quantity: parseInt(elem.quantity, 10),
                    r: globalR,
                }));
            for (const outputQuantity of tmpOutputQuantities) {
                // eslint-disable-next-line
                const vertex = await db.findVertexWithMaxVersion(senderId, outputQuantity.object);
                if (vertex) {
                    const quantities = vertex.data.quantities.private;
                    const quantity = {
                        object: outputQuantity.object,
                        quantity: parseInt(quantities.quantity, 10),
                        r: quantities.r,
                    };
                    outputQuantities.push(quantity);
                } else {
                    outputQuantities.push({
                        added: true,
                        object: outputQuantity.object,
                        quantity: parseInt(outputQuantity.quantity, 10),
                    });
                }
            }
        }
    }
    const quantities = zk.P(importId, eventId, inputQuantities, outputQuantities);
    for (const quantity of quantities.inputs.concat(quantities.outputs)) {
        if (quantity.added) {
            delete quantity.added;
            let batchFound = false;
            for (const batch of batchVertices) {
                if (batch.identifiers.uid === quantity.object) {
                    batchFound = true;
                    batch.data.quantities = quantity;
                    batch._key = md5(`batch_${senderId}_${JSON.stringify(batch.identifiers)}_${JSON.stringify(batch.data)}`);
                    break;
                }
            }
            if (!batchFound) {
                throw new Error(`Invalid import! Batch ${quantity.object} not found.`);
            }
        }
    }
    event.quantities = quantities;
}

/**
 * Create event ID
 * @param senderId  Sender ID
 * @param event     Event data
 * @return {string}
 */
function getEventId(senderId, event) {
    if (arrayze(event.eventTime).length === 0) {
        throw Error('Missing eventTime element for event!');
    }
    const event_time = event.eventTime;

    const event_time_validation = dateTimeValidation(event_time);
    if (!event_time_validation) {
        throw Error('Invalid date and time format for event time!');
    }
    if (typeof event_time !== 'string') {
        throw Error('Multiple eventTime elements found!');
    }
    if (arrayze(event.eventTimeZoneOffset).length === 0) {
        throw Error('Missing event_time_zone_offset element for event!');
    }

    const event_time_zone_offset = event.eventTimeZoneOffset;
    if (typeof event_time_zone_offset !== 'string') {
        throw Error('Multiple event_time_zone_offset elements found!');
    }

    let eventId = `${senderId}:${event_time}Z${event_time_zone_offset}`;
    if (arrayze(event.baseExtension).length > 0) {
        const baseExtension_element = event.baseExtension;

        if (arrayze(baseExtension_element.eventID).length === 0) {
            throw Error('Missing eventID in baseExtension!');
        }
        eventId = baseExtension_element.eventID;
    }
    return eventId;
}

function validateSender(sender) {
    if (sender.EmailAddress) {
        emailValidation(sender.EmailAddress);
    }
}

async function processXML(err, result) {
    const { db } = GSInstance;
    const GLOBAL_R = 131317;
    const importId = Date.now();

    const epcisDocumentElement = result['epcis:EPCISDocument'];

    // Header stuff.
    const standardBusinessDocumentHeaderElement = epcisDocumentElement.EPCISHeader['sbdh:StandardBusinessDocumentHeader'];
    const senderElement = standardBusinessDocumentHeaderElement['sbdh:Sender'];
    const vocabularyListElement =
        epcisDocumentElement.EPCISHeader.extension.EPCISMasterData.VocabularyList;
    const eventListElement = epcisDocumentElement.EPCISBody.EventList;

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
        data: sanitize(senderElement['sbdh:ContactInformation'], {}, ['sbdh:']),
        vertex_type: 'SENDER',
    };

    validateSender(sender.data);

    // Check for vocabularies.
    const vocabularyElements = arrayze(vocabularyListElement.Vocabulary);

    for (const vocabularyElement of vocabularyElements) {
        switch (vocabularyElement.type) {
        case 'urn:ot:mda:actor':
            actors = actors.concat(parseActors(vocabularyElement.VocabularyElementList));
            break;
        case 'urn:ot:mda:product':
            products =
                    products.concat(parseProducts(vocabularyElement.VocabularyElementList));
            break;
        case 'urn:ot:mda:batch':
            batches =
                    batches.concat(parseBatches(vocabularyElement.VocabularyElementList));
            break;
        case 'urn:ot:mda:location':
            locations =
                    locations.concat(parseLocations(vocabularyElement.VocabularyElementList));
            break;
        default:
            throw Error(`Unimplemented or unknown type: ${vocabularyElement.type}.`);
        }
    }

    // Check for events.
    // Types: Transport, Transformation, Observation and Ownership.

    for (const objectEvent of arrayze(eventListElement.ObjectEvent)) {
        events.push(objectEvent);
    }

    if (eventListElement.AggregationEvent) {
        for (const aggregationEvent of arrayze(eventListElement.AggregationEvent)) {
            events.push(aggregationEvent);
        }
    }

    if (eventListElement.extension && eventListElement.extension.TransformationEvent) {
        for (const transformationEvent of
            arrayze(eventListElement.extension.TransformationEvent)) {
            events.push(transformationEvent);
        }
    }

    // pre-fetch from DB.
    const objectClassLocationId = await db.getClassId('Location');
    const objectClassActorId = await db.getClassId('Actor');
    const objectClassProductId = await db.getClassId('Product');
    const objectEventTransportId = await db.getClassId('Transport');
    const objectEventTransformationId = await db.getClassId('Transformation');
    const objectEventObservationId = await db.getClassId('Observation');
    const objectEventOwnershipId = await db.getClassId('Ownership');

    for (const location of locations) {
        const identifiers = {
            id: location.id,
            uid: location.id,
        };
        const data = {
            object_class_id: objectClassLocationId,
        };

        copyProperties(location.attributes, data);

        const locationKey = md5(`business_location_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);
        locationVertices.push({
            _key: locationKey,
            identifiers,
            data,
            vertex_type: 'LOCATION',
        });

        if (location.extension) {
            const attrs = parseAttributes(arrayze(location.extension.attribute), 'urn:ot:location:');
            for (const attr of arrayze(attrs)) {
                if (attr.participantId) {
                    location.participant_id = attr.participantId;

                    locationEdges.push({
                        _key: md5(`owned_by_${senderId}_${locationKey}_${attr.participantId}`),
                        _from: `ot_vertices/${locationKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + attr.participantId}`,
                        edge_type: 'OWNED_BY',
                    });
                }
            }
        }

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
            });
        }
    }

    for (const actor of actors) {
        const identifiers = {
            id: actor.id,
            uid: actor.id,
        };

        const data = {
            object_class_id: objectClassActorId,
        };

        copyProperties(actor.attributes, data);

        actorsVertices.push({
            _key: md5(`actor_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`),
            _id: actor.id,
            identifiers,
            data,
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

        copyProperties(product.attributes, data);

        productVertices.push({
            _key: md5(`product_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`),
            _id: product.id,
            data,
            identifiers,
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

        copyProperties(batch.attributes, data);

        const key = md5(`batch_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);
        batchesVertices.push({
            _key: key,
            identifiers: {
                id: batch.id,
                uid: batch.id,
            },
            data,
            vertex_type: 'BATCH',
        });
    }

    // Store vertices in db. Update versions


    function getClassId(event) {
        // TODO: Support all other types.
        if (event.action && event.action === 'OBSERVE') {
            return objectEventObservationId;
        }
        return objectEventTransformationId;
    }

    // TODO handle extensions
    for (const event of events) {
        const eventId = getEventId(senderId, event);

        const { extension } = event;

        let eventCategories;
        if (extension.extension) {
            const eventClass = extension.extension.OTEventClass;
            eventCategories = arrayze(eventClass).map(obj => ignorePattern(obj, 'ot:events:'));
        } else {
            const eventClass = extension.OTEventClass;
            eventCategories = arrayze(eventClass).map(obj => ignorePattern(obj, 'ot:event:'));
        }

        // eslint-disable-next-line
        await zeroKnowledge(senderId, event, eventId, eventCategories,
            importId, GLOBAL_R, batchesVertices, db,
        );

        const identifiers = {
            id: eventId,
            uid: eventId,
        };

        const data = {
            object_class_id: getClassId(event),
            categories: eventCategories,
        };
        copyProperties(event, data);
        event.vertex_type = 'EVENT';

        const eventKey = md5(`event_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);
        if (extension.extension) {
            const { documentId } = extension.extension;
            if (documentId) {
                identifiers.document_id = documentId;
            }

            const bizStep = ignorePattern(event.bizStep, 'urn:epcglobal:cbv:bizstep:');
            const isSender = bizStep === 'shipping';

            if (extension.extension.sourceList) {
                const sources = arrayze(extension.extension.sourceList.source._);
                for (const source of sources) {
                    eventEdges.push({
                        _key: md5(`source_${senderId}_${eventKey}_${source}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + source}`,
                        edge_type: 'SOURCE',
                    });

                    if (!isSender) {
                        // receiving
                        const filtered = locations.filter(location => location.id === source);
                        for (const location of filtered) {
                            event.partner_id = location.participant_id;
                        }

                        // eslint-disable-next-line
                        const shippingEventVertex = await db.findEvent(senderId, event.partner_id, identifiers.document_id, 'shipping');
                        if (shippingEventVertex.length > 0) {
                            eventEdges.push({
                                _key: md5(`event_connection_${senderId}_${shippingEventVertex[0]._key}_${eventKey}`),
                                _from: `ot_vertices/${shippingEventVertex[0]._key}`,
                                _to: `ot_vertices/${eventKey}`,
                                edge_type: 'EVENT_CONNECTION',
                                transaction_flow: 'OUTPUT',
                            });
                            eventEdges.push({
                                _key: md5(`event_connection_${senderId}_${eventKey}_${shippingEventVertex[0]._key}`),
                                _from: `ot_vertices/${eventKey}`,
                                _to: `ot_vertices/${shippingEventVertex[0]._key}`,
                                edge_type: 'EVENT_CONNECTION',
                                transaction_flow: 'INPUT',
                            });
                        }
                    }
                }
            }

            if (extension.extension.destinationList) {
                const destinations = arrayze(extension.extension.destinationList.destination._);
                for (const destination of destinations) {
                    eventEdges.push({
                        _key: md5(`destination_${senderId}_${eventKey}_${destination}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + destination}`,
                        edge_type: 'DESTINATION',
                    });

                    if (isSender) {
                        // shipping
                        const filtered = locations.filter(location => location.id === destination);
                        for (const location of filtered) {
                            event.partner_id = location.participant_id;
                        }

                        // eslint-disable-next-line
                        const receivingEventVertices = await db.findEvent(senderId, event.partner_id, identifiers.document_id, 'receiving');
                        if (receivingEventVertices.length > 0) {
                            eventEdges.push({
                                _key: md5(`event_connection_${senderId}_${receivingEventVertices[0]._key}_${eventKey}`),
                                _from: `ot_vertices/${receivingEventVertices[0]._key}`,
                                _to: `ot_vertices/${eventKey}`,
                                edge_type: 'EVENT_CONNECTION',
                                transaction_flow: 'INPUT',
                            });
                            eventEdges.push({
                                _key: md5(`event_connection_${senderId}_${eventKey}_${receivingEventVertices[0]._key}`),
                                _from: `ot_vertices/${eventKey}`,
                                _to: `ot_vertices/${receivingEventVertices[0]._key}`,
                                edge_type: 'EVENT_CONNECTION',
                                transaction_flow: 'OUTPUT',
                            });
                        }
                    }
                }
            }
        }

        eventVertices.push({
            _key: eventKey,
            data,
            identifiers,
            partner_id: event.partner_id,
            vertex_type: 'EVENT',
        });

        const { bizLocation } = event;
        if (bizLocation) {
            const bizLocationId = bizLocation.id;
            eventEdges.push({
                _key: md5(`at_${senderId}_${eventKey}_${bizLocationId}`),
                _from: `ot_vertices/${eventKey}`,
                _to: `${EDGE_KEY_TEMPLATE + bizLocationId}`,
                edge_type: 'AT',
            });
        }

        if (event.readPoint) {
            const locationReadPoint = event.readPoint.id;
            eventEdges.push({
                _key: md5(`read_point_${senderId}_${eventKey}_${locationReadPoint}`),
                _from: `ot_vertices/${eventKey}`,
                _to: `${EDGE_KEY_TEMPLATE + event.readPoint.id}`,
                edge_type: 'READ_POINT',
            });
        }

        if (event.inputEPCList) {
            for (const inputEpc of arrayze(event.inputEPCList.epc)) {
                const batchId = inputEpc;

                eventEdges.push({
                    _key: md5(`event_batch_${senderId}_${eventKey}_${batchId}`),
                    _from: `ot_vertices/${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                    edge_type: 'INPUT_BATCH',
                });
            }
        }

        if (event.epcList) {
            for (const inputEpc of arrayze(event.epcList.epc)) {
                const batchId = inputEpc;

                eventEdges.push({
                    _key: md5(`event_batch_${senderId}_${eventKey}_${batchId}`),
                    _from: `ot_vertices/${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                    edge_type: 'EVENT_BATCH',
                });
                eventEdges.push({
                    _key: md5(`event_batch_${senderId}_${batchId}_${eventKey}`),
                    _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                    _to: `ot_vertices/${eventKey}`,
                    edge_type: 'EVENT_BATCH',
                });
            }
        }

        if (event.childEPCs) {
            for (const inputEpc of arrayze(event.childEPCs)) {
                const batchId = inputEpc.epc;

                eventEdges.push({
                    _key: md5(`event_batch_${senderId}_${eventKey}_${batchId}`),
                    _from: `ot_vertices/${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                    edge_type: 'CHILD_BATCH',
                });
            }
        }

        if (event.outputEPCList) {
            for (const outputEpc of arrayze(event.outputEPCList.epc)) {
                const batchId = outputEpc;

                eventEdges.push({
                    _key: md5(`event_batch_${senderId}_${eventKey}_${batchId}`),
                    _from: `ot_vertices/${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                    edge_type: 'OUTPUT_BATCH',
                });
                eventEdges.push({
                    _key: md5(`event_batch_${senderId}_${batchId}_${eventKey}`),
                    _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                    _to: `ot_vertices/${eventKey}`,
                    edge_type: 'OUTPUT_BATCH',
                });
            }
        }

        for (const batch of batchesVertices) {
            const productId = batch.data.parent_id;

            batchEdges.push({
                _key: md5(`batch_product_${senderId}_${batch._key}_${productId}`),
                _from: `ot_vertices/${batch._key}`,
                _to: `${EDGE_KEY_TEMPLATE + productId}`,
                edge_type: 'IS',
            });
        }
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

    const promises = allVertices.map(vertex => db.addVertex(vertex));
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
            const classKey = await db.getClassId(category);
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
            const vertex = await db.findVertexWithMaxVersion(senderId, to.substring(EDGE_KEY_TEMPLATE.length));
            edge._to = `ot_vertices/${vertex._key}`;
        }
        if (from.startsWith(EDGE_KEY_TEMPLATE)) {
            // eslint-disable-next-line
            const vertex = await db.findVertexWithMaxVersion(senderId, from.substring(EDGE_KEY_TEMPLATE.length));
            edge._from = `ot_vertices/${vertex._key}`;
        }
    }

    await Promise.all(allEdges.map(edge => db.addEdge(edge)));

    await Promise.all(allVertices.map(vertex => db.updateImports('ot_vertices', vertex._key, importId)));

    console.log('Done parsing and importing.');
    return { vertices: allVertices, edges: allEdges, import_id: importId };
}

async function parseGS1(gs1XmlFile) {
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
                resolve(processXML(err, json));
            },
        ));
}


module.exports = () => ({
    parseGS1,
});

