module.exports = {
    type: 'object',
    required: ['metadata', 'data', 'ual'],
    properties: {
        metadata: {
            type: 'object',
            required: ['@context', 'type', 'issuer', 'visibility', 'keywords'],
            properties: {
                '@context': {
                    type: 'string',
                },
                type: {
                    type: 'string',
                    minLength: 1,
                },
                issuer: {
                    type: 'string',
                    minLength: 1,
                },
                visibility: {
                    type: 'string',
                    enum: ['public', 'private'],
                },
                keywords: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                    minItems: 1,
                    maxItems: 10,
                },
            },
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
