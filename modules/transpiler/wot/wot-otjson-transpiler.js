const utilities = require('../../Utilities');
const importUtilities = require('../../ImportUtilities');
const OtJsonUtilities = require('../../OtJsonUtilities');
const fs = require('fs');
const Ajv = require('ajv');
const { sha3_256 } = require('js-sha3');

class WotOtJsonTranspiler {
    constructor(ctx) {
        this.config = ctx.config;
        this.web3 = ctx.web3;
        this.connectionTypes = ['PART OF', 'OBSERVES', 'OBSERVATION_READ_POINT'];
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

        const json = JSON.parse(wotJson);
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

        otjson['@id'] = '';
        otjson['@type'] = 'Dataset';
        otjson.datasetHeader = importUtilities.createDatasetHeader(this.config, transpilationInfo);

        let result = OtJsonUtilities.prepareDatasetForNewImport(otjson);
        if (!result) {
            result = otjson;
        }
        result['@id'] = importUtilities.calculateGraphPublicHash(result);
        const merkleRoot = importUtilities.calculateDatasetRootHash(result);
        result.datasetHeader.dataIntegrity.proofs[0].proofValue = merkleRoot;

        // Until we update all routes to work with commands, keep this web3 implementation
        if (this.web3) {
            result = importUtilities.signDataset(result, this.config, this.web3);
        } else {
            const sortedDataset = OtJsonUtilities.prepareDatasetForOldImport(result);
            if (sortedDataset) {
                result = sortedDataset;
            }
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
                identifiers: [
                    {
                        '@type': 'id',
                        '@value': id,
                    },
                    {
                        '@type': 'internal_id',
                        '@value': property.id,
                    },
                    {
                        '@type': 'name',
                        '@value': property.name,
                    },
                ],
                properties: property.values,
                relations: [],
            };

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
                direction: 'reverse', // think about direction
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
            identifiers: [
                {
                    '@type': 'id',
                    '@value': id,
                },
            ],
            relations: [],
            properties: {
                id: thing.id,
                name: thing.name,
                description: thing.description,
                tags: thing.tags,
            },
        };

        const createRelation = (id, relType, data) => ({
            '@type': 'otRelation',
            relationType: relType,
            direction: 'direct', // think about direction
            linkedObject: {
                '@id': id,
            },
            properties: data,
        });

        if (thing.customFields) {
            for (const obj of thing.customFields) {
                let relType;
                switch (obj.type) {
                case 'readPoint':
                    relType = 'OBSERVATION_READ_POINT';
                    break;
                case 'observedObject':
                    relType = 'OBSERVES';
                    break;
                default:
                    relType = 'PART_OF';
                    break;
                }
                otObject.relations.push(createRelation(obj.id, relType, {
                    type: obj.type,
                }));
            }
        }

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
                        identifiers: [
                            {
                                '@type': 'id',
                                '@value': obj.id,
                            },
                        ],
                        relations: [],
                        properties: {
                            '@type': obj.type,
                        },
                    };

                    results.push(otObject);
                }
            }
        }

        return results;
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
        if (!otjson.datasetHeader.transpilationInfo
            || otjson.datasetHeader.transpilationInfo.transpilationInfo.transpilerType !== 'WOT') {
            throw new Error('Unable to convert to requested standard. Original dataset was not imported in WOT format.');
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
                id: otProperty.identifiers.find(x => x['@type'] === 'internal_id')['@value'],
                name: otProperty.identifiers.find(x => x['@type'] === 'name')['@value'],
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
                id: otCustomField.identifiers.find(x => x['@type'] === 'id')['@value'],
                type: otCustomField.properties['@type'],
            };

            customFields.push(customField);
        }

        return customFields;
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
                    encoding: 'UTF-8',
                },
                diff: {},
            },
        };
    }

    getConnectionTypes() {
        return this.connectionTypes;
    }
}

module.exports = WotOtJsonTranspiler;
