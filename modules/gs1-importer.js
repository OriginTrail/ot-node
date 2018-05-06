const { parseString } = require('xml2js');
const fs = require('fs');
const md5 = require('md5');
const deasync = require('deasync-promise');
const xsd = require('libxml-xsd');

const GSInstance = require('./GraphStorageInstance');
const utilities = require('./Utilities');
const async = require('async');
const validator = require('validator');

// Update import data


function updateImportNumber(collection, document, importId) {
    const { db } = GSInstance;
    return db.updateDocumentImports(collection, document, importId);
}

/**
 * Find values helper
 * @param obj
 * @param key
 * @param list
 * @return {*}
 */
function findValuesHelper(obj, key, list) {
    if (!obj) return list;
    if (obj instanceof Array) {
        for (var i in obj) {
            list = list.concat(findValuesHelper(obj[i], key, []));
        }
        return list;
    }
    if (obj[key]) list.push(obj[key]);

    if ((typeof obj === 'object') && (obj !== null)) {
        var children = Object.keys(obj);
        if (children.length > 0) {
            for (i = 0; i < children.length; i += 1) {
                list = list.concat(findValuesHelper(obj[children[i]], key, []));
            }
        }
    }
    return list;
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

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
        const location = {
            type: 'location',
            id: ignorePattern(element.id, 'urn:ot:mda:location:'),
            attributes: parseAttributes(element.attribute, 'urn:ot:mda:location:'),
            child_locations: arrayze(element.children),
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

async function parseGS1(gs1XmlFile, callback) {
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

            const senderId = senderElement['sbdh:Identifier']._;
            const sender = {
                sender_id: {
                    identifiers: {
                        sender_id: senderId,
                        uid: senderElement['sbdh:Identifier']._, // TODO: Maybe not needed anymore.
                    },
                    data: sanitize(senderElement['sbdh:ContactInformation'], {}, ['sbdh:']),
                    vertex_type: 'SENDER',
                },
            };

            const receiver = {
                receiver_id: {
                    identifiers: {
                        receiver_id: receiverElement['sbdh:Identifier']._,
                        uid: receiverElement['sbdh:Identifier']._, // TODO: Maybe not needed anymore.
                    },
                    data: sanitize(receiverElement['sbdh:ContactInformation'], {}, ['sbdh:']),
                    vertex_type: 'RECEIVER',
                },
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

            /*
              "EPCISBody": {
                "EventList": {
                  "extension": {
                    "TransformationEvent": {
             */

            // Check for events.
            // Types: Transport, Transformation, Observation and Ownership.
            // Observation su svi ObjectEvent
            // Transformation su AggregationEvent i extension/TransformationEcent
            // Trenutno nema Transport

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


            // _from: location key _to: ObjectClass_location


            const locationMappings = {
            };

            for (const location of locations) {
                const data = {
                    object_class_id: objectClassLocationId,
                    data: location,
                    vertex_type: 'LOCATION',
                };

                const locationKey = md5(`business_location_${senderId}_${location.id}_${md5(data)}`);
                locationVertices.push({
                    _key: locationKey,
                    _id: location.id,
                    data,
                });
                locationMappings[`business_location_${senderId}_${location.id}`] = locationKey;

                const { child_locations } = location;
                if (child_locations.length > 0) {
                    for (const childId of child_locations[0].id) {
                        const child = {
                            id: childId,
                            data: {
                                // TODO add data
                            },
                        };

                        locationVertices.push({
                            _key: md5(`child_business_location_${senderId}_${child.id}_${md5(child.data)}`),
                            _id: location.id,
                            data,
                        });
                        locationMappings[`business_location_${senderId}_${child.id}`] = `business_location_${senderId}_${child.id}_${child.data}`;

                        locationEdges.push({
                            _key: md5(`business_location_${senderId}_${location.id}_${child.id}_${child.data}`),
                            _from: `ot_vertices/${md5(`child_business_location_${senderId}_${child.id}_${md5(child.data)}`)}`,
                            _to: `ot_vertices/${locationKey}`,
                            edge_type: 'CHILD_BUSINESS_LOCATION',
                        });
                    }
                }
            }

            for (const actor of actors) {
                const data = {
                    object_class_id: objectClassActorId,
                    data: actor,
                    vertex_type: 'ACTOR',
                };

                actorsVertices.push({
                    _key: md5(`actor_${sender.sender_id}_${data}`),
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
                    _key: md5(`product_${sender.sender_id}_${data}`),
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

                batchesVertices.push({
                    _key: md5(`bath_${sender.sender_id}_${data}`),
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
                const data = {
                    object_class_id: getClassId(event),
                    data: event,
                    vertex_type: 'EVENT',
                };

                eventVertices.push({
                    _key: md5(`event_${senderId}_${eventId}_${data}`),
                    _id: eventId,
                    data,
                });

                const { bizLocation } = event;
                if (bizLocation) {
                    const bizLocationId = ignorePattern(bizLocation.id, 'urn:ot:mda:location:');
                    const locationKey = locationMappings[`business_location_${senderId}_${bizLocationId}`];
                    eventEdges.push({
                        _key: md5(`at_${senderId}_${eventId}_${bizLocationId}`),
                        _from: `ot_vertices/${md5(`event_${senderId}_${eventId}_${data}`)}`,
                        _to: `ot_vertices/${md5(locationKey)}`,
                        edge_type: 'AT',
                    });
                }
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

            await Promise.all(allEdges.map(edge => db.addDocument('ot_edges', edge)));
            console.log('Done parsing and importing.');
        },
    );
}


module.exports = () => ({
    parseGS1,
});

