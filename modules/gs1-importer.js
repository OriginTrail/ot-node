const { parseString } = require('xml2js');
const fs = require('fs');
const md5 = require('md5');
const deasync = require('deasync-promise');
const xsd = require('libxml-xsd');

const ZK = require('./ZK');

const zk = new ZK();
const GSInstance = require('./GraphStorageInstance');
const utilities = require('./Utilities');
const async = require('async');
const validator = require('validator');

// Update import data
function updateImportNumber(collection, document, importId) {
    const { db } = GSInstance;
    return db.updateDocumentImports(collection, document, importId);
}

// sanitize

function sanitize(old_obj, new_obj, patterns) {
    if (typeof old_obj !== 'object') { return old_obj; }

    for (const key in old_obj) {
        var new_key = key;

        for (const i in patterns) {
            new_key = new_key.replace(patterns[i], '');
        }

        new_obj[new_key] = sanitize(old_obj[key], {}, patterns);
    }

    return new_obj;
}

// validate
function providerIdValidation(provider_id, validation_object) {
    const data = provider_id;
    const object = validation_object;
    if (data.length === 12) {
        return true;
    }
    return false;
}

function emailValidation(email) {
    const result = validator.isEmail(email);

    if (result) {
        return true;
    }
    return false;
}

function dateTimeValidation(date) {
    const result = validator.isISO8601(date);

    if (result) {
        return true;
    }
    return false;
}

function countryValidation(country) {
    const postal_code = country;

    if (postal_code.length > 2) {
        return false;
    }
    return true;
}

function postalCodeValidation(code) {
    const result = validator.isNumeric(code);

    if (result) {
        return true;
    }
    return false;
}

function longLatValidation(data) {
    const result = validator.isLatLong(data);
    if (result) {
        return true;
    }
    return false;
}

function ean13Validation(eanCode) {
    // Check if only digits
    const ValidChars = '0123456789';
    for (let i = 0; i < eanCode.length; i += 1) {
        const digit = eanCode.charAt(i);
        if (ValidChars.indexOf(digit) === -1) {
            return false;
        }
    }

    // Add five 0 if the code has only 8 digits or 12
    if (eanCode.length === 8) {
        eanCode = `00000${eanCode}`;
    } else if (eanCode.length === 12) {
        eanCode = `0${eanCode}`;
    }

    // Check for 13 digits otherwise
    if (eanCode.length !== 13) {
        return false;
    }

    // Get the check number
    const originalCheck = parseInt(eanCode.substring(eanCode.length - 1), 10);
    eanCode = eanCode.substring(0, eanCode.length - 1);

    // Add even numbers together
    let even = Number(eanCode.charAt(1)) +
        Number(eanCode.charAt(3)) +
        Number(eanCode.charAt(5)) +
        Number(eanCode.charAt(7)) +
        Number(eanCode.charAt(9)) +
        Number(eanCode.charAt(11));
    // Multiply this result by 3
    even *= 3;

    // Add odd numbers together
    const odd = Number(eanCode.charAt(0)) +
        Number(eanCode.charAt(2)) +
        Number(eanCode.charAt(4)) +
        Number(eanCode.charAt(6)) +
        Number(eanCode.charAt(8)) +
        Number(eanCode.charAt(10));

    // Add two totals together
    const total = even + odd;

    // Calculate the checksum
    // Divide total by 10 and store the remainder
    let checksum = total % 10;
    // If result is not 0 then take away 10
    if (checksum !== 0) {
        checksum = 10 - checksum;
    }

    // Return the result
    if (checksum !== originalCheck) {
        return false;
    }

    return true;
}

function numberValidation(num) {
    const number = validator.isDecimal(num, { locale: 'en-AU' });

    if (number) {
        return true;
    }
    return false;
}

function ethWalletValidation(wallet) {
    const eth_wallet = wallet;

    const first_char = eth_wallet.charAt(0);
    const second_char = eth_wallet.charAt(1);
    const rest = eth_wallet.substr(2);
    const rest_hex = validator.isHexadecimal(rest);

    var valid = false;

    if (rest_hex && rest.length === 40) {
        valid = true;
    }

    if (first_char === '0' && second_char === 'x' && valid) {
        return true;
    }
    return false;
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
    /*
        { type: 'urn:ot:mda:location',
            VocabularyElementList: { VocabularyElement: [Object] } } ]
     */
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
        };

        locations.push(location);
    }

    return locations;
}

function parseActors(vocabularyElementList) {
    /*
        { type: 'urn:ot:mda:actor',
            VocabularyElementList: { VocabularyElement: [Object] } } ]
     */

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
    /*
        { type: 'urn:ot:mda:product',
            VocabularyElementList: { VocabularyElement: [Object] } } ]
     */

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
    /*
        { type: 'urn:ot:mda:batch',
            VocabularyElementList: { VocabularyElement: [Array] } } ]
     */

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

    // Storniraj master data.


    // pre-fetch from DB.
    const objectClassLocationId = await db.getClassId('Location');
    const objectClassActorId = await db.getClassId('Actor');
    const objectClassProductId = await db.getClassId('Product');
    const objectClassBatchId = await db.getClassId('Batch');
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
            vertex_type: 'OBJECT',
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
                _key: md5(`child business_location_${senderId}_${location.id}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`),
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
            vertex_type: 'PRODUCT',
        });
    }

    for (const batch of batches) {
        const identifiers = {
            id: batch.id,
            uid: batch.id,
        };

        const data = {
            object_class_id: objectClassBatchId,
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

        const identifiers = {
            id: eventId,
            uid: eventId,
        };

        const data = {
            object_class_id: getClassId(event),
            vertex_type: 'EVENT',
            categories: eventCategories,
        };

        copyProperties(event, data);

        const eventKey = md5(`event_${senderId}_${JSON.stringify(identifiers)}_${md5(JSON.stringify(data))}`);
        eventVertices.push({
            _key: eventKey,
            _id: eventId,
            data,
        });

        if (extension.extension) {
            if (extension.extension.sourceList) {
                const sources = arrayze(extension.extension.sourceList.source._);
                for (const source of sources) {
                    eventEdges.push({
                        _key: md5(`source_${senderId}_${eventId}_${source}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + source}`,
                        edge_type: 'SOURCE',
                    });
                }
            }

            if (extension.extension.destinationList) {
                const destinations = arrayze(extension.extension.destinationList.destination._);
                for (const destination of destinations) {
                    eventEdges.push({
                        _key: md5(`destination_${senderId}_${eventId}_${destination}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + destination}`,
                        edge_type: 'DESTINATION',
                    });
                }
            }
        }


        const { bizLocation } = event;
        if (bizLocation) {
            const bizLocationId = bizLocation.id;
            eventEdges.push({
                _key: md5(`at_${senderId}_${eventId}_${bizLocationId}`),
                _from: `ot_vertices/${eventKey}`,
                _to: `${EDGE_KEY_TEMPLATE + bizLocationId}`,
                edge_type: 'AT',
            });
        }

        if (event.readPoint) {
            const locationReadPoint = event.readPoint.id;
            eventEdges.push({
                _key: md5(`read_point_${senderId}_${eventId}_${locationReadPoint}`),
                _from: `ot_vertices/${eventKey}`,
                _to: `${EDGE_KEY_TEMPLATE + event.readPoint.id}`,
                edge_type: 'AT',
            });
        }

        if (event.inputEPCList) {
            for (const inputEpc of arrayze(event.inputEPCList.epc)) {
                const batchId = inputEpc;

                eventEdges.push({
                    _key: md5(`event_batch_${senderId}_${eventId}_${batchId}`),
                    _from: `ot_vertices/${eventKey}`,
                    _to: `${EDGE_KEY_TEMPLATE + batchId}`,
                    edge_type: 'INPUT_BATCH',
                });
            }
        }

        if (event.childEPCs) {
            for (const inputEpc of arrayze(event.childEPCs)) {
                const batchId = inputEpc.epc;

                eventEdges.push({
                    _key: md5(`event_batch_${senderId}_${eventId}_${batchId}`),
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
                    _key: md5(`event_batch_${senderId}_${eventId}_${batchId}`),
                    _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                    _to: `ot_vertices/${eventKey}`,
                    edge_type: 'OUTPUT_BATCH',
                });
            }
        }


        if (event.parentID) {
            const parentId = event.parentID;
            // TODO: fetch from db.

            // eventEdges.push({
            //     _key: md5(`at_${senderId}_${eventId}_${biz_location}`),
            //     _from: `ot_vertices/${md5(`batch_${sender_id}_${parent_id}`)}`,
            //     _to: `ot_vertices/${md5(`event_${sender_id}_${event_id}`)}`,
            //     edge_type: 'PARENT_BATCH',
            // });
        }

        let inputQuantities = [];
        const outputQuantities = [];
        if (eventCategories.includes('Ownership') || eventCategories.includes('Transport')
            || eventCategories.includes('Observation')) {
            const bizStep = ignorePattern(event.bizStep, 'urn:epcglobal:cbv:bizstep:');

            const { quantityList } = extension;
            if (bizStep === 'shipping') {
                const tmpOutputQuantities = arrayze(quantityList.quantityElement)
                    .map(elem => ({
                        object: elem.epcClass,
                        quantity: parseInt(elem.quantity, 10),
                    }));
                for (const outputQ of tmpOutputQuantities) {
                    // eslint-disable-next-line
                    const vertex = await db.getVertexWithMaxVersion(outputQ.object);
                    if (vertex) {
                        const quantities = vertex.data.quantities.private;
                        const quantity = {
                            object: outputQ.object,
                            quantity: parseInt(quantities.quantity, 10),
                            r: quantities.r,
                        };
                        inputQuantities.push(quantity);
                        outputQuantities.push(quantity);
                    } else {
                        inputQuantities.push({
                            added: true,
                            object: outputQ.object,
                            quantity: parseInt(outputQ.quantity, 10),
                        });
                        outputQuantities.push({
                            added: true,
                            object: outputQ.object,
                            quantity: parseInt(outputQ.quantity, 10),
                            r: GLOBAL_R,
                        });
                    }
                }
            } else {
                inputQuantities = arrayze(quantityList.quantityElement).map(elem => ({
                    object: elem.epcClass,
                    quantity: parseInt(elem.quantity, 10),
                    r: GLOBAL_R,
                }));
                for (const inputQ of inputQuantities) {
                    // eslint-disable-next-line
                    const vertex = await db.getVertexWithMaxVersion(inputQ.object);
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
            const { inputQuantityList, outputQuantityList } = event;
            for (const inputQuantity of inputQuantityList) {
                // eslint-disable-next-line
                const vertex = await db.getVertexWithMaxVersion(inputQuantity.object);
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
            for (const outputQuantity of outputQuantityList) {
                // eslint-disable-next-line
                const vertex = await db.getVertexWithMaxVersion(outputQuantity.object);
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
        const quantities = zk.P(importId, eventId, inputQuantities, outputQuantities);
        for (const quantity of quantities.inputs.concat(quantities.outputs)) {
            if (quantity.added) {
                delete quantity.added;
                let batchFound = false;
                for (const batch of batchesVertices) {
                    if (batch.identifiers.uid === quantity.object) {
                        batchFound = true;
                        batch.data.quantities = quantity;
                        batch._key = md5(`batch_${senderId}_${batch.data}`);
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

    const allVertices =
        locationVertices
            .concat(actorsVertices)
            .concat(productVertices)
            .concat(batchesVertices)
            .concat(eventVertices);

    const promises = allVertices.map(vertex => db.addDocument('ot_vertices', vertex));
    await Promise.all(promises);

    const allEdges = locationEdges
        .concat(eventEdges);

    for (const edge of allEdges) {
        const to = edge._to;
        const from = edge._from;

        if (to.startsWith(EDGE_KEY_TEMPLATE)) {
            // eslint-disable-next-line
            const vertex = await db.getVertexWithMaxVersion(to.substring(EDGE_KEY_TEMPLATE.length));
            edge._to = `ot_vertices/${vertex._key}`;
        }
        if (from.startsWith(EDGE_KEY_TEMPLATE)) {
            // eslint-disable-next-line
            const vertex = await db.getVertexWithMaxVersion(from.substring(EDGE_KEY_TEMPLATE.length));
            edge._from = `ot_vertices/${vertex._key}`;
        }
    }

    await Promise.all(allEdges.map(edge => db.addDocument('ot_edges', edge)));

    console.log('Done parsing and importing.');

    const import_id = Date.now();
    return { vertices: allVertices, edges: allEdges, import_id };
}

async function parseGS1(gs1XmlFile) {
    const gs1XmlFileBuffer = fs.readFileSync(gs1XmlFile);
    const xsdFileBuffer = fs.readFileSync('./importers/EPCglobal-epcis-masterdata-1_2.xsd');
    const schema = xsd.parse(xsdFileBuffer.toString());

    const validationResult = schema.validate(gs1XmlFileBuffer.toString());
    if (validationResult !== null) {
        throw Error(`Failed to validate schema. ${validationResult}`);
    }

    const result = await new Promise((resolve, reject) =>
        parseString(
            gs1XmlFileBuffer,
            { explicitArray: false, mergeAttrs: true },
            /* eslint-disable consistent-return */
            async (err, json) => {
                resolve(processXML(err, json));
            },
        ));

    return result;
}


module.exports = () => ({
    parseGS1,
});

