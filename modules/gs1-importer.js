const { parseString } = require('xml2js');
const fs = require('fs');
const md5 = require('md5');
const deasync = require('deasync-promise');
const xsd = require('libxml-xsd');

const ZK = require('./ZK');
const zk = new ZK;
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

// ////////////////////////////////////

function arrayze(value) {
    if (value) {
        return [].concat(value);
    }
    return [];
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
        let childLocations = arrayze(element.children ? element.children.id : []);
        childLocations = childLocations.map(elem => ignorePattern(elem, 'urn:epc:id:sgln:'));

        const location = {
            type: 'location',
            id: ignorePattern(element.id, 'urn:ot:mda:location:'),
            attributes: parseAttributes(element.attribute, 'urn:ot:mda:location:'),
            child_locations: childLocations,
            // TODO: Add participant ID.
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
            // TODO: Add participant ID.
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
            // TODO: Add participant ID.
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
            // TODO: Add participant ID.
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

async function parseGS1(gs1XmlFile) {
    const { db } = GSInstance;
    const gs1XmlFileBuffer = fs.readFileSync(gs1XmlFile);
    const xsdFileBuffer = fs.readFileSync('./importers/EPCglobal-epcis-masterdata-1_2.xsd');
    const schema = xsd.parse(xsdFileBuffer.toString());

    const validationResult = schema.validate(gs1XmlFileBuffer.toString());
    if (validationResult !== null) {
        throw Error(`Failed to validate schema. ${validationResult}`);
    }

    parseString(
        gs1XmlFileBuffer,
        { explicitArray: false, mergeAttrs: true },
        /* eslint-disable consistent-return */
        async (err, result) => {
            const epcisDocumentElement = result['epcis:EPCISDocument'];

            // Header stuff.
            const standardBusinessDocumentHeaderElement = epcisDocumentElement.EPCISHeader['sbdh:StandardBusinessDocumentHeader'];
            const senderElement = standardBusinessDocumentHeaderElement['sbdh:Sender'];
            const receiverElement = standardBusinessDocumentHeaderElement['sbdh:Receiver']; // TODO: may not exist.
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

            const receiver = {
                identifiers: {
                    id: receiverElement['sbdh:Identifier']._,
                    uid: receiverElement['sbdh:Identifier']._,
                },
                data: sanitize(receiverElement['sbdh:ContactInformation'], {}, ['sbdh:']),
                vertex_type: 'RECEIVER',
            };

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
            const objectClassLocationId = 'dafdsafas';
            const objectClassActorId = 'dafdsafas';
            const objectClassProductId = 'dafdsafas';
            const objectClassBatchId = 'dafdsafas';
            const objectEventTransportId = 'dafdsafas';
            const objectEventTransformationId = 'dafdsafas';
            const objectEventObservationId = 'dafdsafas';
            const objectEventOwnershipId = 'dafdsafas';

            for (const location of locations) {
                const identifiers = {
                    id: location.id,
                    uid: location.id,
                };
                const data = {
                    object_class_id: objectClassLocationId,
                };

                const locationKey = md5(`business_location_${senderId}_${md5(identifiers)}_${md5(data)}`);
                locationVertices.push({
                    _key: locationKey,
                    identifiers,
                    data,
                });

                const { child_locations } = location;
                for (const childId of child_locations) {
                    const identifiers = {
                        id: childId,
                        uid: childId,
                    };
                    const data = {
                        parent_id: location.id,
                        // TODO add data
                    };

                    const childLocationKey = md5(`child_business_location_${senderId}_${md5(identifiers)}_${md5(data)}`);
                    locationVertices.push({
                        _key: childLocationKey,
                        identifiers,
                        data,
                        vertex_type: 'CHILD_BUSINESS_LOCATION',
                    });

                    locationEdges.push({
                        _key: md5(`child business_location_${senderId}_${location.id}_${md5(identifiers)}_${md5(data)}`),
                        _from: `ot_vertices/${childLocationKey}`,
                        _to: `ot_vertices/${locationKey}`,
                        edge_type: 'CHILD_BUSINESS_LOCATION',
                    });
                }
            }

            for (const actor of actors) {
                const data = {
                    object_class_id: objectClassActorId,
                    data: actor,
                    vertex_type: 'ACTOR',
                };

                actorsVertices.push({
                    _key: md5(`actor_${senderId}_${data}`),
                    _id: actor.id,
                    data,
                });
            }

            for (const product of products) {
                const data = {
                    object_class_id: objectClassProductId,
                    data: product,
                    vertex_type: 'PRODUCT',
                };

                productVertices.push({
                    _key: md5(`product_${senderId}_${data}`),
                    _id: product.id,
                    data,
                });
            }

            for (const batch of batches) {
                const data = {
                    object_class_id: objectClassBatchId,
                    data: batch,
                    vertex_type: 'BATCH',
                };

                const key = md5(`batch_${senderId}_${data}`);
                batchesVertices.push({
                    _key: key,
                    _id: batch.id,
                    data,
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
                    data: event,
                    vertex_type: 'EVENT',
                    categories: eventCategories,
                };

                const eventKey = md5(`event_${senderId}_${md5(identifiers)}_${md5(data)}`);
                eventVertices.push({
                    _key: eventKey,
                    _id: eventId,
                    data,
                });

                if (extension.extension) {
                    const sources = arrayze(extension.extension.sourceList.source._).map(s => ignorePattern(s, 'urn:ot:mda:location:'));
                    for (const source of sources) {
                        const locationKey = null; // TODO fetch from db
                        eventEdges.push({
                            _key: md5(`source_${senderId}_${eventId}_${source}`),
                            _from: `ot_vertices/${eventKey}`,
                            _to: `ot_vertices/${locationKey}`,
                            edge_type: 'SOURCE',
                        });
                    }

                    const destinations = arrayze(extension.extension.destinationList.destination._).map(s => ignorePattern(s, 'urn:ot:mda:location:'));
                    for (const destination of destinations) {
                        const locationKey = null; // TODO fetch from db
                        eventEdges.push({
                            _key: md5(`destination_${senderId}_${eventId}_${destination}`),
                            _from: `ot_vertices/${eventKey}`,
                            _to: `ot_vertices/${locationKey}`,
                            edge_type: 'DESTINATION',
                        });
                    }
                }


                const { bizLocation } = event;
                if (bizLocation) {
                    const bizLocationId = ignorePattern(bizLocation.id, 'urn:ot:mda:location:');
                    eventEdges.push({
                        _key: md5(`at_${senderId}_${eventId}_${bizLocationId}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + bizLocationId}`,
                        edge_type: 'AT',
                    });
                }

                if (event.readPoint) {
                    const locationReadPoint = ignorePattern(event.readPoint.id, 'urn:ot:mda:location:');
                    eventEdges.push({
                        _key: md5(`read_point_${senderId}_${eventId}_${locationReadPoint}`),
                        _from: `ot_vertices/${eventKey}`,
                        _to: `${EDGE_KEY_TEMPLATE + event.readPoint.id}`,
                        edge_type: 'AT',
                    });
                }

                if (event.inputEPCList) {
                    for (const inputEpc of arrayze(event.inputEPCList.epc)) {
                        const batchId = ignorePattern(inputEpc, 'urn:epc:id:sgtin:');

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
                        const batchId = ignorePattern(inputEpc.epc, 'urn:epc:id:sgtin:');

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
                        const batchId = ignorePattern(outputEpc, 'urn:epc:id:sgtin:');

                        eventEdges.push({
                            _key: md5(`event_batch_${senderId}_${eventId}_${batchId}`),
                            _from: `${EDGE_KEY_TEMPLATE + batchId}`,
                            _to: `ot_vertices/${eventKey}`,
                            edge_type: 'OUTPUT_BATCH',
                        });
                    }
                }


                if (event.parentID) {
                    const parentId = ignorePattern(event.parentID, 'urn:epc:id:sgtin:');
                    // TODO: fetch from db.

                    // eventEdges.push({
                    //     _key: md5(`at_${senderId}_${eventId}_${biz_location}`),
                    //     _from: `ot_vertices/${md5(`batch_${sender_id}_${parent_id}`)}`,
                    //     _to: `ot_vertices/${md5(`event_${sender_id}_${event_id}`)}`,
                    //     edge_type: 'PARENT_BATCH',
                    // });
                }


                let inputQuantities = [{object: 'abcd', quantity: 3, unit: 'kg'},{object: 'efgh', quantity: 13, unit: 'kg'},{object: 'ijkl', quantity: 2, unit: 'kg'}];
                let outputQuantities = [{object: 'mnop', quantity: 4, unit: 'kg'},{object: 'qrst', quantity: 11, r:16, unit: 'kg'},{object: 'uvwx', quantity: 2, unit: 'kg'}];

                const quantities = zk.P(importId, eventId, inputQuantities, outputQuantities);

                event.quantities = quantities;
            }


            await db.createCollection('ot_vertices');
            await db.createEdgeCollection('ot_edges');

            const allVertices =
                locationVertices
                    .concat(actorsVertices)
                    .concat(productVertices)
                    .concat(batchesVertices)
                    .concat(eventVertices);

            await Promise.all(allVertices.map(vertex => db.addDocument('ot_vertices', vertex)));

            const allEdges = locationEdges
                .concat(eventEdges);

            for (const edge of allEdges) {
                const to = edge._to;
                const from = edge._from;

                if (to.startsWith(EDGE_KEY_TEMPLATE)) {
                    // eslint-disable-next-line
                    edge._to = await db.getVertexKeyWithMaxVersion(to.substring(EDGE_KEY_TEMPLATE.length));
                }
                if (from.startsWith(EDGE_KEY_TEMPLATE)) {
                    // eslint-disable-next-line
                    edge._from = await db.getVertexKeyWithMaxVersion(from.substring(EDGE_KEY_TEMPLATE.length));
                }
            }

            await Promise.all(allEdges.map(edge => db.addDocument('ot_edges', edge)));
            console.log('Done parsing and importing.');
        },
    );
}


module.exports = () => ({
    parseGS1,
});

