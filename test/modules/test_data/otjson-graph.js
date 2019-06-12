const graph = {
    '@graph': [
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
    ],
    '@id': '0x189e5ab5ffe717397a6dbbc058db0f2985ba8872c39f3fca160c3bafe3c24f81',
    '@type': 'Dataset',
    datasetHeader: {
        OTJSONVersion: '1.0',
        dataCreator: {
            identifiers: [
                {
                    identifierType: 'ERC725',
                    identifierValue: '0x9ffb5578ad7e54db19b6421e97a129f17d9b541e',
                    validationSchema: '/schemas/erc725-main',
                },
            ],
        },
        dataIntegrity: {
            proofs: [
                {
                    proofType: 'merkleRootHash',
                    proofValue: '0x135ff3e9c5936039b07f47efb7b9008064bdbf75f3b552ea3844ad6d60fbeb19',
                    validationSchema: '/schemas/merkleRoot',
                },
            ],
        },
        datasetCreationTimestamp: '2019-06-11T11:06:54.010Z',
        datasetTags: [],
        datasetTitle: '',
        relatedDatasets: [],
        transpilationInfo: {
            diff: {
                _declaration: {
                    _attributes: {
                        encoding: 'UTF-8',
                        version: '1.0',
                    },
                },
                _doctype: 'project',
                'epcis:EPCISDocument': {
                    EPCISBody: {
                        EventList: {},
                    },
                    EPCISHeader: {
                        extension: {
                            EPCISMasterData: {
                                VocabularyList: {},
                            },
                        },
                        'p:StandardBusinessDocumentHeader': {
                            'p:DocumentIdentification': {
                                'p:CreationDateAndTime': {
                                    _text: '2001-12-31T12:00:00',
                                },
                                'p:InstanceIdentifier': {
                                    _text: 'p:InstanceIdentifier',
                                },
                                'p:MultipleType': {
                                    _text: 'true',
                                },
                                'p:Standard': {
                                    _text: 'EPCglobal',
                                },
                                'p:Type': {
                                    _text: 'MasterData',
                                },
                                'p:TypeVersion': {
                                    _text: '1.2',
                                },
                            },
                            'p:HeaderVersion': {
                                _text: '1.2',
                            },
                            'p:Receiver': {
                                'p:Identifier': {
                                    _attributes: {
                                        Authority: '',
                                    },
                                    _text: 'p:Identifier',
                                },
                            },
                            'p:Sender': {
                                'p:Identifier': {
                                    _attributes: {
                                        Authority: '',
                                    },
                                    _text: 'p:Identifier',
                                },
                            },
                        },
                    },
                    _attributes: {
                        creationDate: '2005-07-11T11:30:47.0Z',
                        schemaVersion: '1.2',
                        'xmlns:epcis': 'urn:epcglobal:epcis:xsd:1',
                        'xmlns:example': 'http://ns.example.com/epcis',
                        'xmlns:p': 'http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                    },
                },
            },
            transpilationInfo: {
                diff: {},
                sourceMetadata: {
                    XMLversion: '1.0',
                    created: '2019-06-11T11:06:53.984Z',
                    encoding: 'UTF-8',
                    modified: '2019-06-11T11:06:53.984Z',
                    standard: 'GS1-EPCIS',
                },
                transpilerType: 'GS1-EPCIS',
                transpilerVersion: '1.0',
            },
        },
        validationSchemas: {
            'erc725-main': {
                networkId: 'ganache',
                schemaType: 'ethereum-725',
            },
            merkleRoot: {
                hubContractAddress: '0x6E9d88d683B7c4c24BC2cA2e188BAc6691708956',
                networkId: 'ganache',
                schemaType: 'merkle-root',
            },
        },
    },
    signature: {
        type: 'ethereum-signature',
        value: '0xeba5893a0fab40704dcd79662ac6c71978cc05ca38bb3e3a7567950b867a6a997e1920cc2fdebdf5cbd38509c2d097a9a512f89e21b0771de08777e8e8af75ff1b',
    },
};

module.exports = graph;
