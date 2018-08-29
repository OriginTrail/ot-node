const md5 = require('md5');
const crypto = require('crypto');
const validator = require('validator');
const Utilities = require('./Utilities');
const stringify = require('json-stable-stringify');
const Barcoder = require('barcoder');

const ZK = require('./ZK');

class GS1Utilities {
    constructor(ctx) {
        this.db = ctx.graphStorage;
        this.ctx = ctx;
    }

    /**
     * Creates key for the document
     * @param args
     * @return {*}
     */
    createKey(...args) {
        const params = [];
        for (const argument of args) {
            params.push(`${stringify(argument)}`);
        }
        return md5(`${params.join('_')}`);
    }

    handleError(message, status) {
        const err = new Error(message);
        err.status = status;
        throw err;
    }

    validateEan13(code) {
        const res = Barcoder.validate(code);
        if (!res) {
            this.handleError(`Invalid EAN13: ${code}`, 400);
        }
    }

    validateSender(sender) {
        if (sender.EmailAddress) {
            this.emailValidation(sender.EmailAddress);
        }
    }

    emailValidation(email) {
        const result = validator.isEmail(email);
        return !!result;
    }

    copyProperties(from, to) {
        for (const property in from) {
            to[property] = from[property];
        }
    }

    parseAttributes(attributes, ignorePattern) {
        const output = {};
        const inputAttributeArray = this.arrayze(attributes);

        for (const inputElement of inputAttributeArray) {
            output[inputElement.id.replace(ignorePattern, '')] = inputElement._;
        }
        return output;
    }

    parseIdentifiers(attributes, ignorePattern) {
        const output = {};
        const inputAttributeArray = this.arrayze(attributes);

        for (const inputElement of inputAttributeArray) {
            if (inputElement.identifier) {
                if (inputElement.id) {
                    const value = inputElement._;
                    this.validateEan13(value);
                    output[inputElement.id.replace(ignorePattern, '')] = value;
                } else {
                    this.handleError('Failed to parse XML. ID is missing for the identifier attribute.', 400);
                }
            }
        }
        return output;
    }

    ignorePattern(attribute, ignorePattern) {
        return attribute.replace(ignorePattern, '');
    }

    sanitize(old_obj, new_obj, patterns) {
        if (typeof old_obj !== 'object') { return old_obj; }

        for (const key in old_obj) {
            let new_key = key;
            for (const i in patterns) {
                new_key = new_key.replace(patterns[i], '');
            }
            new_obj[new_key] = this.sanitize(old_obj[key], {}, patterns);
        }
        return new_obj;
    }

    dateTimeValidation(date) {
        const result = validator.isISO8601(date);
        return !!result;
    }

    arrayze(value) {
        if (value) {
            return [].concat(value);
        }
        return [];
    }

    getEventId(senderId, event) {
        if (this.arrayze(event.eventTime).length === 0) {
            this.handleError('Missing eventTime element for event!', 400);
        }
        const event_time = event.eventTime;

        const event_time_validation = this.dateTimeValidation(event_time);
        if (!event_time_validation) {
            this.handleError('Invalid date and time format for event time!', 400);
        }
        if (typeof event_time !== 'string') {
            this.handleError('Multiple eventTime elements found!', 400);
        }
        if (this.arrayze(event.eventTimeZoneOffset).length === 0) {
            this.handleError('Missing event_time_zone_offset element for event!', 400);
        }

        const event_time_zone_offset = event.eventTimeZoneOffset;
        if (typeof event_time_zone_offset !== 'string') {
            this.handleError('Multiple event_time_zone_offset elements found!', 400);
        }

        let eventId = `${senderId}:${event_time}Z${event_time_zone_offset}`;
        if (this.arrayze(event.baseExtension).length > 0) {
            const baseExtension_element = event.baseExtension;

            if (this.arrayze(baseExtension_element.eventID).length === 0) {
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
    async handlePrivate(senderId, uid, _private, data, privateData) {
        data.private = {};

        const existingVertex = await this.db.findVertexWithMaxVersion(senderId, uid);
        let salt = null;
        if (existingVertex && existingVertex.private) {
            salt = existingVertex.private._salt;
        }
        if (salt == null) {
            salt = crypto.randomBytes(16).toString('base64');
        }
        for (const key in _private) {
            const value = _private[key];
            privateData[key] = value;

            const sorted = Utilities.sortObject(value);
            data.private[key] = Utilities.soliditySHA3(JSON.stringify(`${sorted}${salt}`));
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
    checkPrivate(hashed, original, salt) {
        const result = {};
        for (const key in original) {
            const value = original[key];
            const sorted = Utilities.sortObject(value);
            result[key] = Utilities.soliditySHA3(JSON.stringify(`${sorted}${salt}`));
        }
        return Utilities.objectDistance(hashed, result);
    }

    /**
     * Helper function for finding batch either in memory or in db
     * @param senderId
     * @param batchVertices
     * @param uid
     * @return {Promise<void>}
     * @private
     */
    async _findBatch(senderId, batchVertices, uid) {
        // check in memory
        for (const batchVertex of batchVertices) {
            if (batchVertex.identifiers.uid === uid) {
                return batchVertex;
            }
        }
        // check in db
        return this.db.findVertexWithMaxVersion(senderId, uid);
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
    async zeroKnowledge(
        senderId, event, eventId, categories,
        importId, globalR, batchVertices,
    ) {
        let inputQuantities = [];
        let outputQuantities = [];
        const { extension } = event;
        if (categories.includes('Ownership') || categories.includes('Transport') ||
            categories.includes('Observation')) {
            const bizStep = this.ignorePattern(event.bizStep, 'urn:epcglobal:cbv:bizstep:');

            const { quantityList } = extension;
            if (bizStep === 'shipping') {
                // sending input
                if (categories.includes('Ownership')) {
                    outputQuantities = this.arrayze(quantityList.quantityElement)
                        .map(elem => ({
                            object: elem.epcClass,
                            quantity: parseInt(elem.quantity, 10),
                            r: globalR,
                        }));
                } else {
                    outputQuantities = this.arrayze(quantityList.quantityElement)
                        .map(elem => ({
                            object: elem.epcClass,
                            quantity: parseInt(elem.quantity, 10),
                        }));
                }

                for (const outputQ of outputQuantities) {
                    // eslint-disable-next-line
                    const vertex = await this._findBatch(senderId, batchVertices, outputQ.object);
                    if (vertex && vertex.data.quantities) {
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
                    inputQuantities = this.arrayze(quantityList.quantityElement)
                        .map(elem => ({
                            object: elem.epcClass,
                            quantity: parseInt(elem.quantity, 10),
                            r: globalR,
                        }));
                } else {
                    inputQuantities = this.arrayze(quantityList.quantityElement)
                        .map(elem => ({
                            object: elem.epcClass,
                            quantity: parseInt(elem.quantity, 10),
                        }));
                }

                for (const inputQ of inputQuantities) {
                    // eslint-disable-next-line
                    const vertex = await this._findBatch(senderId, batchVertices, inputQ.object);
                    if (vertex && vertex.data.quantities) {
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
                const tmpInputQuantities = this.arrayze(inputQuantityList.quantityElement)
                    .map(elem => ({
                        object: elem.epcClass,
                        quantity: parseInt(elem.quantity, 10),
                        r: globalR,
                    }));
                for (const inputQuantity of tmpInputQuantities) {
                    // eslint-disable-next-line
                    const vertex = await this._findBatch(senderId, batchVertices, inputQuantity.object);
                    if (vertex && vertex.data.quantities) {
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
                const tmpOutputQuantities = this.arrayze(outputQuantityList.quantityElement)
                    .map(elem => ({
                        object: elem.epcClass,
                        quantity: parseInt(elem.quantity, 10),
                        r: globalR,
                    }));
                for (const outputQuantity of tmpOutputQuantities) {
                    // eslint-disable-next-line
                    const vertex = await this._findBatch(senderId, batchVertices, outputQuantity.object);
                    if (vertex && vertex.data.quantities) {
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
        const zk = new ZK(this.ctx);
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
