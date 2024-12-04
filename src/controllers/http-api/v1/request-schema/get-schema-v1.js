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
        hashFunctionId: {
            type: 'number',
            minimum: 1,
        },
        paranetUAL: {
            type: 'string',
        },
    },
});
