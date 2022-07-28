module.exports = {
    type: 'object',
    required: ['assertion_id', 'assertion'],
    properties: {
        assertion_id: {
            type: 'string',
        },
        assertion: {
            type: 'array',
            items: {
                type: 'string',
            },
            minItems: 1,
        },
        options: {
            type: 'object',
            ual: {
                type: 'string',
                minLength: 1,
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
};
