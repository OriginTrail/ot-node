const OtJsonImporter = require('../../modules/otJsonImporter');

const {
    describe, before, beforeEach, afterEach, it,
} = require('mocha');
const chai = require('chai');

const { assert } = chai;

describe('OT-JSON importer tests', () => {
    const testOtJsonFile =
    [
        {
            '@id': 'urn:epc:id:sgln:0037000.00729.0',
            '@type': 'otObject',
            identifiers: [
                {
                    '@type': 'locationReference',
                    '@value': '00729',
                },
                {
                    '@type': 'companyPrefix',
                    '@value': '037000',
                },
                {
                    '@type': 'gln',
                    '@value': '037000007296',
                },
                {
                    '@type': 'extension',
                    '@value': '0',
                },
                {
                    '@type': 'sgln',
                    '@value': 'urn:epc:id:sgln:0037000.00729.0',
                },
            ],
            properties: {
                ___metadata: {
                    _attributes: {
                        id: 'urn:epc:id:sgln:0037000.00729.0',
                    },
                    attribute: [
                        {
                            _attributes: {
                                id: 'http://epcis.example.com/mda/latitude',
                            },
                        },
                        {
                            _attributes: {
                                id: 'http://epcis.example.com/mda/longitude',
                            },
                        },
                        {
                            _attributes: {
                                id: 'http://epcis.example.com/mda/address',
                            },
                            'example:Address': {
                                City: null,
                                State: null,
                                Street: null,
                                Zip: null,
                                _attributes: {
                                    'xmlns:example': 'http://epcis.example.com/ns',
                                },
                            },
                        },
                    ],
                    children: {
                        id: [
                            null,
                            null,
                            null,
                            null,
                        ],
                    },
                },
                children: [
                    'urn:epc:id:sgln:0037000.00729.8201',
                    'urn:epc:id:sgln:0037000.00729.8202',
                    'urn:epc:id:sgln:0037000.00729.8203',
                    'urn:epc:id:sgln:0037000.00729.8204',
                ],
                'http://epcis.example.com/mda/address': {
                    'example:Address': {
                        City: 'Fancy',
                        State: 'DC',
                        Street: '100 Nowhere Street',
                        Zip: '99999',
                    },
                },
                'http://epcis.example.com/mda/latitude': '+18.0000',
                'http://epcis.example.com/mda/longitude': '-70.0000',
                objectType: 'vocabularyElement',
                vocabularyType: 'urn:epcglobal:epcis:vtype:BusinessLocation',
            },
            relations: [
                {
                    '@type': 'otRelation',
                    direction: 'direct',
                    linkedObject: {
                        '@id': 'urn:epc:id:sgln:0037000.00729.8202',
                    },
                    properties: {
                        relationType: 'HAS_CHILD',
                    },
                },
                {
                    '@type': 'otRelation',
                    direction: 'direct',
                    linkedObject: {
                        '@id': 'urn:epc:id:sgln:0037000.00729.8203',
                    },
                    properties: {
                        relationType: 'HAS_CHILD',
                    },
                },
                {
                    '@type': 'otRelation',
                    direction: 'direct',
                    linkedObject: {
                        '@id': 'urn:epc:id:sgln:0037000.00729.8204',
                    },
                    properties: {
                        relationType: 'HAS_CHILD',
                    },
                },
                {
                    '@type': 'otRelation',
                    direction: 'direct',
                    linkedObject: {
                        '@id': 'urn:epc:id:sgln:0037000.00729.8201',
                    },
                    properties: {
                        relationType: 'HAS_CHILD',
                    },
                },
            ],
        },
        {
            '@id': 'urn:epc:id:sgln:0037000.00729.8201',
            '@type': 'otObject',
            identifiers: [
                {
                    '@type': 'sgln',
                    '@value': 'urn:epc:id:sgln:0037000.00729.8201',
                },
                {
                    '@type': 'locationReference',
                    '@value': '00729',
                },
                {
                    '@type': 'extension',
                    '@value': '8201',
                },
                {
                    '@type': 'companyPrefix',
                    '@value': '037000',
                },
                {
                    '@type': 'gln',
                    '@value': '037000007296',
                },
            ],
            properties: {
                ___metadata: {
                    _attributes: {
                        id: 'urn:epc:id:sgln:0037000.00729.8201',
                    },
                    attribute: [
                        {
                            _attributes: {
                                id: 'urn:epcglobal:cbv:mda:site',
                            },
                        },
                        {
                            _attributes: {
                                id: 'urn:epcglobal:cbv:mda:sst',
                            },
                        },
                    ],
                },
                objectType: 'vocabularyElement',
                'urn:epcglobal:cbv:mda:site': '0037000007296',
                'urn:epcglobal:cbv:mda:sst': '201',
                vocabularyType: 'urn:epcglobal:epcis:vtype:ReadPoint',
            },
        },
        {
            '@id': 'urn:epc:id:sgln:0037000.00729.8202',
            '@type': 'otObject',
            identifiers: [
                {
                    '@type': 'locationReference',
                    '@value': '00729',
                },
                {
                    '@type': 'sgln',
                    '@value': 'urn:epc:id:sgln:0037000.00729.8202',
                },
                {
                    '@type': 'companyPrefix',
                    '@value': '037000',
                },
                {
                    '@type': 'gln',
                    '@value': '037000007296',
                },
                {
                    '@type': 'extension',
                    '@value': '8202',
                },
            ],
            properties: {
                ___metadata: {
                    _attributes: {
                        id: 'urn:epc:id:sgln:0037000.00729.8202',
                    },
                    attribute: [
                        {
                            _attributes: {
                                id: 'urn:epcglobal:cbv:mda:site',
                            },
                        },
                        {
                            _attributes: {
                                id: 'urn:epcglobal:cbv:mda:sst',
                            },
                        },
                    ],
                },
                objectType: 'vocabularyElement',
                'urn:epcglobal:cbv:mda:site': '0037000007296',
                'urn:epcglobal:cbv:mda:sst': '202',
                vocabularyType: 'urn:epcglobal:epcis:vtype:ReadPoint',
            },
        },
        {
            '@id': 'urn:epc:id:sgln:0037000.00729.8203',
            '@type': 'otObject',
            identifiers: [
                {
                    '@type': 'locationReference',
                    '@value': '00729',
                },
                {
                    '@type': 'sgln',
                    '@value': 'urn:epc:id:sgln:0037000.00729.8203',
                },
                {
                    '@type': 'companyPrefix',
                    '@value': '037000',
                },
                {
                    '@type': 'gln',
                    '@value': '037000007296',
                },
                {
                    '@type': 'extension',
                    '@value': '8203',
                },
            ],
            properties: {
                ___metadata: {
                    _attributes: {
                        id: 'urn:epc:id:sgln:0037000.00729.8203',
                    },
                    attribute: [
                        {
                            _attributes: {
                                id: 'urn:epcglobal:cbv:mda:site',
                            },
                        },
                        {
                            _attributes: {
                                id: 'urn:epcglobal:cbv:mda:sst',
                            },
                        },
                    ],
                },
                objectType: 'vocabularyElement',
                'urn:epcglobal:cbv:mda:site': '0037000007296',
                'urn:epcglobal:cbv:mda:sst': '203',
                vocabularyType: 'urn:epcglobal:epcis:vtype:ReadPoint',
            },
        },
        {
            '@id': 'urn:epc:id:sgln:0037000.00729.8204',
            '@type': 'otObject',
            identifiers: [
                {
                    '@type': 'extension',
                    '@value': '8204',
                },
                {
                    '@type': 'locationReference',
                    '@value': '00729',
                },
                {
                    '@type': 'sgln',
                    '@value': 'urn:epc:id:sgln:0037000.00729.8204',
                },
                {
                    '@type': 'companyPrefix',
                    '@value': '037000',
                },
                {
                    '@type': 'gln',
                    '@value': '037000007296',
                },
            ],
            properties: {
                ___autogenerated: true,
                objectType: 'vocabularyElement',
            },
        },
    ];

    const importer = new OtJsonImporter({});

    it('Test _validateRelatedEntities()', () => {
        const graph = testOtJsonFile;

        try {
            importer._validateRelatedEntities(graph);
        } catch (error) {
            assert.isFalse(!!error, 'OT-JSON has invalid form');
        }
    });
});
