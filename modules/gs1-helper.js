const md5 = require('md5');
const validator = require('validator');

const ZK = require('./ZK');

class GS1Helper {
    // validate

    static validateSender(sender) {
        if (sender.EmailAddress) {
            GS1Helper.emailValidation(sender.EmailAddress);
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
        const inputAttributeArray = GS1Helper.arrayze(attributes);

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
            new_obj[new_key] = GS1Helper.sanitize(old_obj[key], {}, patterns);
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
        if (GS1Helper.arrayze(event.eventTime).length === 0) {
            throw Error('Missing eventTime element for event!');
        }
        const event_time = event.eventTime;

        const event_time_validation = GS1Helper.dateTimeValidation(event_time);
        if (!event_time_validation) {
            throw Error('Invalid date and time format for event time!');
        }
        if (typeof event_time !== 'string') {
            throw Error('Multiple eventTime elements found!');
        }
        if (GS1Helper.arrayze(event.eventTimeZoneOffset).length === 0) {
            throw Error('Missing event_time_zone_offset element for event!');
        }

        const event_time_zone_offset = event.eventTimeZoneOffset;
        if (typeof event_time_zone_offset !== 'string') {
            throw Error('Multiple event_time_zone_offset elements found!');
        }

        let eventId = `${senderId}:${event_time}Z${event_time_zone_offset}`;
        if (GS1Helper.arrayze(event.baseExtension).length > 0) {
            const baseExtension_element = event.baseExtension;

            if (GS1Helper.arrayze(baseExtension_element.eventID).length === 0) {
                throw Error('Missing eventID in baseExtension!');
            }
            eventId = baseExtension_element.eventID;
        }
        return eventId;
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
    static async zeroKnowledge(
        senderId, event, eventId, categories,
        importId, globalR, batchVertices, db,
    ) {
        let inputQuantities = [];
        let outputQuantities = [];
        const { extension } = event;
        if (categories.includes('Ownership') || categories.includes('Transport') ||
            categories.includes('Observation')) {
            const bizStep = GS1Helper.ignorePattern(event.bizStep, 'urn:epcglobal:cbv:bizstep:');

            const { quantityList } = extension;
            if (bizStep === 'shipping') {
                // sending input
                if (categories.includes('Ownership')) {
                    outputQuantities = GS1Helper.arrayze(quantityList.quantityElement)
                        .map(elem => ({
                            object: elem.epcClass,
                            quantity: parseInt(elem.quantity, 10),
                            r: globalR,
                        }));
                } else {
                    outputQuantities = GS1Helper.arrayze(quantityList.quantityElement)
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
                    inputQuantities = GS1Helper.arrayze(quantityList.quantityElement).map(elem => ({
                        object: elem.epcClass,
                        quantity: parseInt(elem.quantity, 10),
                        r: globalR,
                    }));
                } else {
                    inputQuantities = GS1Helper.arrayze(quantityList.quantityElement).map(elem => ({
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
                const tmpInputQuantities = GS1Helper.arrayze(inputQuantityList.quantityElement)
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
                const tmpOutputQuantities = GS1Helper.arrayze(outputQuantityList.quantityElement)
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
                    throw new Error(`Invalid import! Batch ${quantity.object} not found.`);
                }
            }
        }
        event.quantities = quantities;
    }
}

module.exports = GS1Helper;
