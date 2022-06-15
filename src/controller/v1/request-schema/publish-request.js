module.exports = {
    type: 'object',
    required: ['metadata', 'data', 'ual'],
    properties: {
        metadata: {
            type: 'array',
            items: {
                type: 'string',
            },
            minItems: 5,
        },
        data: {
            type: 'array',
            items: {
                type: 'string',
            },
            minItems: 1,
        },
        ual: {
            type: 'string',
            minLength: 1,
        },
    },
};
