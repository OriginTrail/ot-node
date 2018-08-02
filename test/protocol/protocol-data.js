const protocolData = {};


protocolData.vertices = [
    {
        _id: '247d8e3809b448fe8f5b67495801e246',
        _key: '247d8e3809b448fe8f5b67495801e246',
        identifiers: {
            id: 'urn:epc:id:sgln:Building_2',
            uid: 'urn:epc:id:sgln:Building_2',
        },
        data: {
            category: 'Building _2b',
            description: 'Description of building _2b',
            object_class_id: 'Location',
        },
        private: {},
        vertex_type: 'LOCATION',
        sender_id: 'urn:ot:object:actor:id:Company_2',
        version: 1,
        imports: [],
    },
    {
        _id: 'Location',
        _key: 'Location',
        vertex_type: 'CLASS',
    },
];

protocolData.edges = [
    {
        _id: 'af54d5a366006fa21dcbf4df50421165',
        _key: '_key:af54d5a366006fa21dcbf4df50421165',
        _from: '247d8e3809b448fe8f5b67495801e246',
        _to: 'Location',
        edge_type: 'IS',
        sender_id: 'urn:ot:object:actor:id:Company_2',
        imports: [],
    },
];

module.exports = protocolData;
