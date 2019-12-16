const databaseData = {};

databaseData.vertices = [{
    _key: '0xb0b07c594db5f7321d81b60b83f8bd52a09ec3d23d95a70318c40347ee4a8b26',
    vertexType: 'Data',
    data: {
        objectType: 'vocabularyElement',
        vocabularyType: 'urn:epcglobal:epcis:vtype:ReadPoint',
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
        'urn:epcglobal:cbv:mda:site': '0037000007296',
        'urn:epcglobal:cbv:mda:sst': '202',
    },
    datasets: [
        '0xe6386173e8f4e59038db10677d7b066e8a924703ddc13426ea5f22e05600aea9',
    ],
},
{
    _key: '0xd5993149b27751620ba70be97eb48a3b6222fc7129348d36b804c41985622d3e',
    uid: 'urn:epc:id:sgln:0037000.00729.8202',
    vertexType: 'EntityObject',
    objectType: 'otObject',
    datasets: [
        '0xe6386173e8f4e59038db10677d7b066e8a924703ddc13426ea5f22e05600aea9',
    ],
},
{
    _key: '0x7818ea29a95335230539a56907cdddda6519c43b151c68685073b92de1749971',
    identifierValue: 'urn:epc:id:sgln:0037000.00729.1234',
    vertexType: 'Identifier',
    identifierType: 'id',
    datasets: [
        '0xe6386173e8f4e59038db10677d7b066e8a924703ddc13426ea5f22e05600aea9',
    ],
},
];

databaseData.edges = [
    {
        _key: '0x8c18e27785af981e407072ee850c3fd31cab225cd087647c7d7992df524c663a',
        _from: '0xd5993149b27751620ba70be97eb48a3b6222fc7129348d36b804c41985622d3e',
        _to: '0xb0b07c594db5f7321d81b60b83f8bd52a09ec3d23d95a70318c40347ee4a8b26',
        edgeType: 'dataRelation',
        relationType: 'HAS_DATA',
        datasets: [
            '0xe6386173e8f4e59038db10677d7b066e8a924703ddc13426ea5f22e05600aea9',
        ],
    },
    {
        _key: '0x1238ea29a95335230539a56907cdddda6519c43b151c68685073b92de1749971',
        _from: '0x7818ea29a95335230539a56907cdddda6519c43b151c68685073b92de1749971',
        _to: '0xd5993149b27751620ba70be97eb48a3b6222fc7129348d36b804c41985622d3e',
        edgeType: 'IdentifierRelation',
        relationType: 'IDENTIFIED_BY',
        datasets: [
            '0xe6386173e8f4e59038db10677d7b066e8a924703ddc13426ea5f22e05600aea9',
        ],
    },
];

module.exports = databaseData;
