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
        bizStep: 'bizTest',
    },
    vertex_type: 'BUSINESS_LOCATION',
    identifiers: {
        BusinessLocationId: 'FARM_1',
        uid: 'ot:WALLET_ID:otblid:FARM_1',
        document_id: '1000',
    },
    vertex_key: '2e0b1ba163be76138d51a0b8258e97d7',
    _key: '2e0b1ba163be76138d51a0b8258e97d7',
    imports: [
        1520345631,
    ],
    data_provider: 'WALLET_ID',
    sender_id: 'a',
    partner_id: [
        'senderID',
    ],
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
    sender_id: 'a',
},
];

databaseData.edges = [
    {
        _key: '6eb743d84a605b2ab6be67a373b883d4',
        edge_type: 'OWNED_BY',
        data_provider: 'WALLET_ID',
        imports: [1520345631],
        _from: '2e0b1ba163be76138d51a0b8258e97d7',
        _to: 'cd923bec4266a7f63b68722da254f205',
        sender_id: 'a',
    },
];

module.exports = databaseData;
