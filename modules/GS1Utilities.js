const md5 = require('md5');
const crypto = require('crypto');
const validator = require('validator');
const Utilities = require('./Utilities');
const stringify = require('json-stable-stringify');

const ZK = require('./ZK');

class GS1Utilities {
    /**
     * Creates key for the document
     * @param args
     * @return {*}
     */
    static createKey(...args) {
        const params = [];
        for (const argument of args) {
            params.push(`${stringify(argument)}`);
        }
        return md5(`${params.join('_')}`);
    }

    static handleError(message, status) {
        const err = new Error(message);
        err.status = status;
        throw err;
    }

    static validateSender(sender) {
        if (sender.EmailAddress) {
            GS1Utilities.emailValidation(sender.EmailAddress);
        }
    }

    static emailValidation(email) {
        const result = validator.isEmail(email);
        return !!result;
    }

    static copyProperties(from, to) {
        for (const property in from) {
            to[property] = from[property];
        }
    }

    static parseAttributes(attributes, ignorePattern) {
        const output = {};
        const inputAttributeArray = GS1Utilities.arrayze(attributes);

        for (const inputElement of inputAttributeArray) {
            output[inputElement.id.replace(ignorePattern, '')] = inputElement._;
        }
        return output;
    }

    static ignorePattern(attribute, ignorePattern) {
        return attribute.replace(ignorePattern, '');
    }

    static sanitize(old_obj, new_obj, patterns) {
        if (typeof old_obj !== 'object') { return old_obj; }

        for (const key in old_obj) {
            let new_key = key;
            for (const i in patterns) {
                new_key = new_key.replace(patterns[i], '');
            }
            new_obj[new_key] = GS1Utilities.sanitize(old_obj[key], {}, patterns);
        }
        return new_obj;
    }

    static dateTimeValidation(date) {
        const result = validator.isISO8601(date);
        return !!result;
    }

    static arrayze(value) {
        if (value) {
            return [].concat(value);
        }
        return [];
    }

    static getEventId(senderId, event) {
        if (GS1Utilities.arrayze(event.eventTime).length === 0) {
            this.handleError('Missing eventTime element for event!', 400);
        }
        const event_time = event.eventTime;

        const event_time_validation = GS1Utilities.dateTimeValidation(event_time);
        if (!event_time_validation) {
            this.handleError('Invalid date and time format for event time!', 400);
        }
        if (typeof event_time !== 'string') {
            this.handleError('Multiple eventTime elements found!', 400);
        }
        if (GS1Utilities.arrayze(event.eventTimeZoneOffset).length === 0) {
            this.handleError('Missing event_time_zone_offset element for event!', 400);
        }

        const event_time_zone_offset = event.eventTimeZoneOffset;
        if (typeof event_time_zone_offset !== 'string') {
            this.handleError('Multiple event_time_zone_offset elements found!', 400);
        }

        let eventId = `${senderId}:${event_time}Z${event_time_zone_offset}`;
        if (GS1Utilities.arrayze(event.baseExtension).length > 0) {
            const baseExtension_element = event.baseExtension;

            if (GS1Utilities.arrayze(baseExtension_element.eventID).length === 0) {
                this.handleError('Missing eventID in baseExtension!', 400);
            }
            eventId = baseExtension_element.eventID;
        }
        return eventId;
    }

    /**
     * Handle private data
     * @private
     */
    static handlePrivate(_private, data, privateData) {
        data.private = {};
        const salt = crypto.randomBytes(16).toString('base64');
        for (const key in _private) {
            const value = _private[key];
            privateData[key] = value;

            const sorted = Utilities.sortObject(value);
            data.private[key] = Utilities.sha3(JSON.stringify(`${sorted}${salt}`));
        }
        privateData._salt = salt;
    }

    /**
     * Check hidden data
     * @param hashed
     * @param original
     * @param salt
     * @return {*}
     */
    static checkPrivate(hashed, original, salt) {
        const result = {};
        for (const key in original) {
            const value = original[key];
            const sorted = Utilities.sortObject(value);
            result[key] = Utilities.sha3(JSON.stringify(`${sorted}${salt}`));
        }
        return Utilities.objectDistance(hashed, result);
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
     * @param db
     * @return {Promise<void>}
     */
    static async zeroKnowledge(
        senderId, event, eventId, categories,
        importId, globalR, batchVertices, db,
    ) {
        let inputQuantities = [];
        let outputQuantities = [];
        const { extension } = event;
        if (categories.includes('Ownership') || categories.includes('Transport') ||
            categories.includes('Observation')) {
            const bizStep = GS1Utilities.ignorePattern(event.bizStep, 'urn:epcglobal:cbv:bizstep:');

            const { quantityList } = extension;
            if (bizStep === 'shipping') {
                // sending input
                if (categories.includes('Ownership')) {
                    outputQuantities = GS1Utilities.arrayze(quantityList.quantityElement)
                        .map(elem => ({
                            object: elem.epcClass,
                            quantity: parseInt(elem.quantity, 10),
                            r: globalR,
                        }));
                } else {
                    outputQuantities = GS1Utilities.arrayze(quantityList.quantityElement)
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
                    inputQuantities = GS1Utilities.arrayze(quantityList.quantityElement)
                        .map(elem => ({
                            object: elem.epcClass,
                            quantity: parseInt(elem.quantity, 10),
                            r: globalR,
                        }));
                } else {
                    inputQuantities = GS1Utilities.arrayze(quantityList.quantityElement)
                        .map(elem => ({
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
                const tmpInputQuantities = GS1Utilities.arrayze(inputQuantityList.quantityElement)
                    .map(elem => ({
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
                const tmpOutputQuantities = GS1Utilities.arrayze(outputQuantityList.quantityElement)
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
        const zk = new ZK();
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
                    this.handleError(`Invalid import! Batch ${quantity.object} not found.`, 400);
                }
            }
        }
        event.quantities = quantities;
    }
}

module.exports = GS1Utilities;
