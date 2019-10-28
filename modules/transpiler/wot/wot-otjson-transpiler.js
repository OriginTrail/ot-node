const utilities = require('../../Utilities');
const importUtilities = require('../../ImportUtilities');
const fs = require('fs');
const Ajv = require('ajv');
const { sha3_256 } = require('js-sha3');

class WotOtJsonTranspiler {
    constructor(ctx) {
        this.config = ctx.config;
        this.web3 = ctx.web3;
    }

    /**
     * Convert WOT JSON document to OT-JSON
     * @param wotJson - json string
     * @return {*} - OT-JSON object
     */
    convertToOTJson(wotJson) {
        if (wotJson == null) {
            throw new Error('[Transpilation Error] JSON document cannot be empty');
        }

        const jsonFileBuffer = fs.readFileSync('./modules/transpiler/wot/json_schemas/wot_schema.json');
        const validator = new Ajv();
        const validate = validator.compile(jsonFileBuffer);
        const valid = validate(wotJson);
        if (!valid) {
            throw Error(`[Transpilation Error] Failed to validate schema. ${validate.errors}`);
        }

        const rawJson = this._removeCommentsAndTrimTexts(wotJson);
        const json = JSON.parse(rawJson);
        const otjson = {
            '@graph': [],
        };

        const otThing = this._convertThingsFromJson(json);
        const otProperties = this._convertPropertiesFromJson(json);
        const otCustomFields = this._convertCustomFieldsFromJson(json);

        otjson['@graph'].push(...otThing);
        otjson['@graph'].push(...otProperties);
        otjson['@graph'].push(...otCustomFields);

        if (otThing.length > 0) {
            delete json.things.thing;
        }

        if (otProperties.length > 0) {
            delete json.things.properties;
        }

        const transpilationInfo = this._getTranspilationInfo();
        transpilationInfo.diff = json;

        otjson['@id'] = importUtilities.calculateGraphHash(otjson['@graph']);
        otjson['@type'] = 'Dataset';

        otjson.datasetHeader = importUtilities.createDatasetHeader(this.config, transpilationInfo);

        const merkleRoot = importUtilities.calculateDatasetRootHash(otjson['@graph'], otjson['@id'], otjson.datasetHeader.dataCreator);

        otjson.datasetHeader.dataIntegrity.proofs[0].proofValue = merkleRoot;

        // Until we update all routes to work with commands, keep this web3 implementation
        let result;
        if (this.web3) {
            result = importUtilities.signDataset(otjson, this.config, this.web3);
        } else {
            result = importUtilities.sortStringifyDataset(otjson);
        }
        return result;
    }

    /**
     * Converts properties from JSON format to OT-JSON
     */
    _convertPropertiesFromJson(object) {
        const { things } = object;
        if (things == null) {
            throw new Error('Invalid WOT document!');
        }

        const root = things.properties;
        if (root == null) {
            return [];
        }

        const result = [];
        for (const property of root) {
            const id = `0x${sha3_256(`${things.thing.name}.${things.thing.id}.${property.id}`, null, 0)}`;

            const otObject = {
                '@type': 'otObject',
                '@id': id,
                identifiers: [{
                    '@type': 'uuid',
                    '@value': id,
                }, {
                    '@type': 'id',
                    '@value': property.id,
                }, {
                    '@type': 'name',
                    '@value': property.name,
                },
                ],
            };
            otObject.properties = property.values;
            otObject.relations = [];

            result.push(otObject);
        }
        return result;
    }

    /**
     * Converts things to OT-JSON objects
     * @param object - original JSON parsed WOT JSON data
     * @return {Array} - Array of OT-JSON objects
     * @private
     */
    _convertThingsFromJson(object) {
        const { things } = object;
        if (things == null) {
            throw new Error('Invalid WOT document!');
        }

        if (things.thing == null) {
            return [];
        }

        if (things.properties == null) {
            return [];
        }

        const results = [];
        if (things.thing) {
            const otObject = this._convertThingFromJson(things.thing);

            const createRelation = (id, data) => ({
                '@type': 'otRelation',
                relationType: 'PART_OF',
                direction: 'direct', // think about direction
                linkedObject: {
                    '@id': id,
                },
                properties: data,
            });
            for (const property of things.properties) {
                const id = `0x${sha3_256(`${things.thing.name}.${things.thing.id}.${property.id}`, null, 0)}`;
                otObject.relations.push(createRelation(id, {
                    type: property.id,
                }));
            }

            results.push(otObject);
        }

        return results;
    }

    /**
     * Converts thing to OT-JSON event object
     * @param thing - Thing from original JSON data
     * @return Thing json
     * @private
     */
    _convertThingFromJson(thing) {
        const id = `0x${sha3_256(`${thing.name}.${thing.id}`, null, 0)}`;

        const otObject = {
            '@type': 'otObject',
            '@id': id,
            identifiers: [{
                '@type': 'uuid',
                '@value': id,
            },
            ],
        };

        otObject.relations = [];
        otObject.properties = {
            id: thing.id,
            name: thing.name,
            description: thing.description,
            tags: thing.tags,
        };

        const createRelation = (id, data) => ({
            '@type': 'otRelation',
            relationType: 'PART_OF',
            direction: 'direct', // think about direction
            linkedObject: {
                '@id': id,
            },
            properties: data,
        });

        if (thing.customFields) {
            for (const obj of thing.customFields) {
                otObject.relations.push(createRelation(obj.id, {
                    type: obj.type,
                }));
            }
        }

        // Object.assign(otObject.properties, thing);
        return otObject;
    }


    /**
     * Converts custom fields to OT-JSON objects
     * @param object - original JSON parsed WOT JSON data
     * @return {Array} - Array of OT-JSON objects
     * @private
     */
    _convertCustomFieldsFromJson(object) {
        const { things } = object;
        if (things == null) {
            throw new Error('Invalid WOT document!');
        }

        if (things.thing == null) {
            return [];
        }

        const results = [];
        if (things.thing) {
            if (things.thing.customFields) {
                for (const obj of things.thing.customFields) {
                    const otObject = {
                        '@type': 'otObject',
                        '@id': obj.id,
                        identifiers: [{
                            '@type': 'uuid',
                            '@value': obj.id,
                        },
                        ],
                    };
                    otObject.properties = {
                        '@type': obj.type,
                    };

                    otObject.relations = [];

                    results.push(otObject);
                }
            }
        }

        return results;
    }

    /**
     * Remove comments from raw json
     */
    _removeCommentsAndTrimTexts(obj) {
        if (typeof obj === 'object' || Array.isArray((obj))) {
            if (this._isLeaf(obj)) {
                obj._text = obj._text.trim();
            }
            if (obj._comment) {
                delete obj._comment;
            }
            for (const key of Object.keys(obj)) {
                obj[key] = this._removeCommentsAndTrimTexts(obj[key]);
            }
        }
        Object.keys(obj).forEach(k => (obj[k] === undefined ? delete obj[k] : '')); // remove undefined
        return obj;
    }

    /**
     * Convert OT-JSON to WOT JSON document
     * @param otjson - OT-JSON object
     * @return {string} - JSON string
     */
    convertFromOTJson(otjson) {
        if (otjson == null) {
            throw new Error('OT-JSON document cannot be empty');
        }
        const json = utilities.copyObject(otjson.datasetHeader.transpilationInfo.diff);

        const graph = utilities.copyObject(otjson['@graph']);

        const otProperties = graph.filter(x => x.relations.length === 0 && !['readPoint', 'observedObject'].includes(x.properties['@type']));
        if (otProperties.length > 0) {
            json.things.properties = this._convertPropertiesToJson(otProperties);
        }

        const otThing = graph.filter(x => x.relations.length > 0);
        if (otThing.length > 0) {
            json.things.thing = this._convertThingToJson(otThing[0]);
        }

        const otCustomFields = graph.filter(x => x.relations.length === 0 && ['readPoint', 'observedObject'].includes(x.properties['@type']));
        if (otCustomFields.length > 0) {
            json.things.thing.customFields = this._convertCustomFieldsToJson(otCustomFields);
        }

        return json;
    }

    /**
     * Converts properties from OT-JSON format to JSON
     */
    _convertPropertiesToJson(otProperties) {
        const results = [];
        for (const otProperty of otProperties) {
            const { properties } = otProperty;
            const property = {
                id: otProperty.identifiers.filter(x => x['@type'] === 'id')[0]['@value'],
                name: otProperty.identifiers.filter(x => x['@type'] === 'name')[0]['@value'],
                values: properties,
            };

            results.push(property);
        }
        return results;
    }

    /**
     * Converts thing from OT-JSON format to JSON
     */
    _convertThingToJson(otThing) {
        const thing = {
            id: otThing.properties.id,
            name: otThing.properties.name,
            description: otThing.properties.description,
            tags: otThing.properties.tags,

        };

        return thing;
    }

    /**
     * Converts custom fields from OT-JSON format to JSON
     */
    _convertCustomFieldsToJson(otCustomFields) {
        const customFields = [];
        for (const otCustomField of otCustomFields) {
            const customField = {
                id: otCustomField.identifiers.filter(x => x['@type'] === 'uuid')[0]['@value'],
                type: otCustomField.properties['@type'],
            };

            customFields.push(customField);
        }

        return customFields;
    }

    /**
     * Is leaf node in the original JSON document
     * @param object - Original JSON document
     * @return {boolean}
     * @private
     */
    _isLeaf(object) {
        return object._text != null;
    }

    /**
     * Gets transpilation information.
     * Diff should be populated with unparsed data from original EPCIS document
     * @return *
     */
    _getTranspilationInfo() {
        const created = new Date();
        return {
            transpilationInfo: {
                transpilerType: 'WOT',
                transpilerVersion: '1.0',
                sourceMetadata: {
                    created: created.toISOString(),
                    modified: created.toISOString(),
                    standard: 'WOT',
                    XMLversion: '1.0',
                    encoding: 'UTF-8',
                },
                diff: {},
            },
        };
    }
}

module.exports = WotOtJsonTranspiler;
