export default () => ({
    type: 'object',
    required: ['id'],
    properties: {
        id: {
            type: 'string',
        },
        contentType: {
            type: 'string',
        },
        includeMetadata: {
            type: 'boolean',
        },
        paranetUAL: {
            type: ['string', 'null'],
        },
    },
});
