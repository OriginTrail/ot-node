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
    }
};

const shuffledGraph = {
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
            merkleRoot: {
                hubContractAddress: '0x6E9d88d683B7c4c24BC2cA2e188BAc6691708956',
                networkId: 'ganache',
                schemaType: 'merkle-root',
            },
            'erc725-main': {
                networkId: 'ganache',
                schemaType: 'ethereum-725',
            },
        },
    }
};

const graph2 = {
    '@graph': [
        {
            '@id': 'urn:epc:id:sgln:0037000.00729.0',
            '@type': 'otObject',
            properties: {
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
                        '@id': 'urn:epc:id:sgln:0037000.00729.8202',
                    },
                    properties: {
                        relationType: 'READ_POINT',
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
            ],
        },
        {
            '@id': 'urn:epc:id:sgln:0037000.00729.8201',
            '@type': 'otObject',
            properties: {
                objectType: 'vocabularyElement',
                'urn:epcglobal:cbv:mda:site': '0037000007296',
                'urn:epcglobal:cbv:mda:sst': '201',
                vocabularyType: 'urn:epcglobal:epcis:vtype:ReadPoint',
            },
            relations: [
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
    ],
};

const graph3 = {
    "@graph": [{
        "@type": "otObject",
        "@id": "urn:uuid:4522de5e-9bc2-4a75-b04a-996a6ab17ce6",
        "identifiers": [{"@type": "uuid", "@value": "urn:uuid:4522de5e-9bc2-4a75-b04a-996a6ab17ce6"}],
        "relations": [{
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.7VFZB0V6G545FZAW9YT7"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.S4A9HXWHAXGZANE92DZM"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.P25P0ZV6KB26TEZB24F6"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.DN015S9641V45CFBCX8N"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.ER72M16Y5Y7CAFEW1E93"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.N0014KNEDRE337VG421W"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.224F46H7H4X55B9B113C"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.YEHB4NWA5WTBGKDABYGW"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.N5Y3SGB9C25P1126XVKD"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgtin:38512345.24121452145214.B6VPXEMV8T6NPHPSVWWP"},
            "properties": {"relationType": "EPC"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgln:38512345.3851234500005"},
            "properties": {"relationType": "SOURCE"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgln:38512345.3851234500005"},
            "properties": {"relationType": "BIZ_LOCATION"}
        }, {
            "@type": "otRelation",
            "direction": "direct",
            "linkedObject": {"@id": "urn:epc:id:sgln:38512345.3851234500005"},
            "properties": {"relationType": "READ_POINT"}
        }],
        "properties": {
            "objectType": "TransactionEvent",
            "___metadata": {
                "eventTime": null,
                "eventTimeZoneOffset": null,
                "bizTransactionList": {"bizTransaction": [{"_attributes": {"type": "urn:epcglobal:cbv:btt:pedigree"}}]},
                "epcList": {"epc": [null, null, null, null, null, null, null, null, null, null]},
                "action": null,
                "bizStep": null,
                "disposition": null,
                "readPoint": {"id": null},
                "bizLocation": {"id": null},
                "extension": {"sourceList": {"source": [{"_attributes": {"type": "urn:epcglobal:cbv:sdt:owning_party"}}]}},
                "example0:expiry": {"_attributes": {"xsi:type": "xsd:dateTime"}},
                "example1:lot": {"_attributes": {"xsi:type": "xsd:int"}}
            },
            "eventTime": "2016-08-17T00:00:00.000Z",
            "eventTimeZoneOffset": "+02:00",
            "bizTransactionList": {"bizTransaction": ["urn:epcglobal:cbv:bt:38512345.3851234500005:209"]},
            "epcList": {"epc": ["urn:epc:id:sgtin:38512345.24121452145214.7VFZB0V6G545FZAW9YT7", "urn:epc:id:sgtin:38512345.24121452145214.S4A9HXWHAXGZANE92DZM", "urn:epc:id:sgtin:38512345.24121452145214.P25P0ZV6KB26TEZB24F6", "urn:epc:id:sgtin:38512345.24121452145214.DN015S9641V45CFBCX8N", "urn:epc:id:sgtin:38512345.24121452145214.ER72M16Y5Y7CAFEW1E93", "urn:epc:id:sgtin:38512345.24121452145214.N0014KNEDRE337VG421W", "urn:epc:id:sgtin:38512345.24121452145214.224F46H7H4X55B9B113C", "urn:epc:id:sgtin:38512345.24121452145214.YEHB4NWA5WTBGKDABYGW", "urn:epc:id:sgtin:38512345.24121452145214.N5Y3SGB9C25P1126XVKD", "urn:epc:id:sgtin:38512345.24121452145214.B6VPXEMV8T6NPHPSVWWP"]},
            "action": "ADD",
            "bizStep": "urn:epcglobal:cbv:bizstep:shipping",
            "disposition": "urn:epcglobal:cbv:disp:in_progress",
            "readPoint": {"id": "urn:epc:id:sgln:38512345.3851234500005"},
            "bizLocation": {"id": "urn:epc:id:sgln:38512345.3851234500005"},
            "extension": {"sourceList": {"source": ["urn:epc:id:sgln:38512345.3851234500005"]}},
            "example0:expiry": "2018-06-08T14:58:56.591Z",
            "example1:lot": "15123"
        }
    }, {
        "@id": "urn:uuid:63212f6a-7223-477c-87c7-199d3c3601f4",
        "@type": "otConnector",
        "connectionId": "urn:epcglobal:cbv:bt:38512345.3851234500005:209",
        "relations": [{
            "@type": "otRelation",
            "direction": "reverse",
            "linkedObject": {"@id": "urn:uuid:4522de5e-9bc2-4a75-b04a-996a6ab17ce6"},
            "properties": {"relationType": "CONNECTOR_FOR"}
        }]
    }],
    "@id": "0x4588b47fe852d2e74b835c05a5a5d602df84699f9d39e72ecee6a1bdac519ac2",
    "@type": "Dataset",
    "datasetHeader": {
        "OTJSONVersion": "1.0",
        "datasetCreationTimestamp": "2019-06-06T13:32:14.024Z",
        "datasetTitle": "",
        "datasetTags": [],
        "relatedDatasets": [],
        "validationSchemas": {
            "erc725-main": {"schemaType": "ethereum-725", "networkId": "rinkeby"},
            "merkleRoot": {"schemaType": "merkle-root", "networkId": "rinkeby"}
        },
        "dataIntegrity": {
            "proofs": [{
                "proofValue": "0x3d55efb001f24fc0ae2e80afa056dee5d38fa15c7def92e3f7f713622cc867fe",
                "proofType": "merkleRootHash",
                "validationSchema": "/schemas/merkleRoot"
            }]
        },
        "dataCreator": {
            "identifiers": [{
                "identifierType": "ERC725",
                "validationSchema": "/schemas/erc725-main",
                "identifierValue": "0x2029a07cc3dc96a82b3260ebc1fed1d7"
            }]
        },
        "transpilationInfo": {
            "transpilationInfo": {
                "transpilerType": "GS1-EPCIS",
                "transpilerVersion": "1.0",
                "sourceMetadata": {
                    "created": "2019-06-06T13:32:11.398Z",
                    "modified": "2019-06-06T13:32:11.398Z",
                    "standard": "GS1-EPCIS",
                    "XMLversion": "1.0",
                    "encoding": "UTF-8"
                },
                "diff": {}
            },
            "diff": {
                "_declaration": {"_attributes": {"version": "1.0", "encoding": "UTF-8", "standalone": "yes"}},
                "_doctype": "project",
                "epcis:EPCISDocument": {
                    "_attributes": {
                        "schemaVersion": "1.2",
                        "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
                        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                        "xmlns:example0": "http://ns.example.com/epcis0",
                        "xmlns:example1": "http://ns.example.com/epcis1",
                        "xmlns:example2": "http://ns.example.com/epcis2",
                        "xmlns:example3": "http://ns.example.com/epcis3",
                        "xmlns:example": "http://ns.example.com/epcis",
                        "creationDate": "2013-06-04T14:59:02.099+02:00",
                        "xmlns:epcis": "urn:epcglobal:epcis:xsd:1"
                    }, "EPCISBody": {}
                }
            }
        }
    },
    "signature": {
        "value": "0x18269f9ff4daefe903aba693d5647771015e45577d8fd3aa06a4b59268125dd537fce3956d59b4616be7a4a4b9aec766bbdf74a8ad8942939267723b2181b56d1c",
        "type": "ethereum-signature"
    }
};

module.exports = { graph, shuffledGraph, graph2, graph3 };
