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
            id: element.id,
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
            const locationVertices = [];
            const actorsVertices = [];
            const productVertices = [];
            const batchesVertices = [];

            const sender = {
                sender_id: {
                    identifiers: {
                        sender_id: senderElement['sbdh:Identifier']._,
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
                console.log(vocabularyElement);

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

            if (eventListElement.extensions && eventListElement.extensions.TransformationEvent) {
                for (const transformationEvent of
                    arrayze(eventListElement.extensions.TransformationEvent)) {
                    events.push(transformationEvent);
                }
            }

            // Storniraj master data.


            // pre-fetch from DB.
            const objectClassLocationId = 'dafdsafas';
            const objectClassActorId = 'dafdsafas';
            const objectClassProductId = 'dafdsafas';
            const objectClassBatchId = 'dafdsafas';


            // _from: location key _to: ObjectClass_location


            for (const location of locations) {
                const data = {
                    object_class_id: objectClassLocationId,
                    data: location,
                    vertex_type: 'LOCATION',
                };

                locationVertices.push({
                    _key: md5(`business_location_${sender.sender_id}_${data}`),
                    _id: location.id,
                    data,
                });
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

            for (const event of events) {
                // Do stuff for events. Create edges.
            }
        },
    );
}


module.exports = () => ({
    parseGS1,
});

