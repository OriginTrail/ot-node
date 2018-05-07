const databaseData = {};

databaseData.vertices = [{
    data: {
        BusinessLocationName: {
            EN: "Partner's Farm",
        },
        BusinessLocationType: 'Farm',
        Location: {
            Address: "Farmer's Street 01B",
            City: 'Bytesfield',
            Country: 'Cryptonia',
            GeoLocation: {
                Latitude: '00.0000',
                Longitude: '00.0000',
            },
            Zip: '20000',
        },
    },
    vertex_type: 'BUSINESS_LOCATION',
    identifiers: {
        BusinessLocationId: 'FARM_1',
        uid: 'ot:WALLET_ID:otblid:FARM_1',
    },
    vertex_key: '2e0b1ba163be76138d51a0b8258e97d7',
    _key: '2e0b1ba163be76138d51a0b8258e97d7',
    imports: [
        1520345631,
    ],
    data_provider: 'WALLET_ID',
    version: 1,
},

{
    data: {
        Location: {
            Address: "Farmer's Street 01B",
            City: 'Bytesfield',
            Country: 'Cryptonia',
            GeoLocation: {
                Latitude: '00.0000',
                Longitude: '00.0000',
            },
            Zip: '20000',
        },
        Name: {
            EN: 'Partner',
        },
    },
    vertex_type: 'PARTICIPANT',
    identifiers: {
        ParticipantId: 'PARTNER_ID',
        uid: 'ot:WALLET_ID:otpartid:PARTNER_ID',
    },
    vertex_key: 'cd923bec4266a7f63b68722da254f205',
    _key: 'cd923bec4266a7f63b68722da254f205',
    imports: [1520345631],
    version: 1,
},

{
    data: {
        BusinessLocationName: {
            EN: "Partner's Farm",
        },
        BusinessLocationType: 'Farm',
        Location: {
            Address: "Farmer's Street 01B",
            City: 'Bytesfield',
            Country: 'Cryptonia',
            GeoLocation: {
                Latitude: '00.0000',
                Longitude: '00.0000',
            },
            Zip: '20000',
        },
    },
    vertex_type: 'BUSINESS_LOCATION',
    identifiers: {
        BusinessLocationId: 'FARM_1',
        uid: 'ot:WALLET_ID:otblid:FARM_1',
    },
    vertex_key: '2e0b1ba163be76138d51a0b8258e97d7',
    _key: '2e0b1ba163be76138d51a0b8258e97d8',
    imports: [
        1520345631,
    ],
    data_provider: 'WALLET_ID',
    version: 2,
},

{
    data: {
        BusinessLocationName: {
            EN: "Partner's Farm",
        },
        BusinessLocationType: 'Farm',
        Location: {
            Address: "Farmer's Street 01B",
            City: 'Bytesfield',
            Country: 'Cryptonia',
            GeoLocation: {
                Latitude: '00.0000',
                Longitude: '00.0000',
            },
            Zip: '20000',
        },
    },
    vertex_type: 'BUSINESS_LOCATION',
    identifiers: {
        BusinessLocationId: 'FARM_1',
        uid: 'ot:WALLET_ID:otblid:FARM_1',
    },
    vertex_key: '2e0b1ba163be76138d51a0b8258e97d7',
    _key: '2e0b1ba163be76138d51a0b8258e97d9',
    imports: [
        1520345631,
    ],
    data_provider: 'WALLET_ID',
    version: 3,
},
];

databaseData.edges = [
    {
        _key: '6eb743d84a605b2ab6be67a373b883d4',
        edge_type: 'OWNED_BY',
        data_provider: 'WALLET_ID',
        imports: [1520345631],
        _from: 'ot_vertices/2e0b1ba163be76138d51a0b8258e97d7',
        _to: 'ot_vertices/cd923bec4266a7f63b68722da254f205',
    },
];

module.exports = databaseData;
