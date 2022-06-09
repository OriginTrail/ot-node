module.exports = {
    type: 'object',
    required: ['keywords', 'visibility'],
    properties: {
        keywords: {
            type: 'string',
            minLength: 1,
        },
        visibility: {
            type: 'string',
            enum: ['public', 'private'],
            minLength: 1,
        },
        data: {
            type: 'string',
            minLength: 1,
        },
        ual: {
            type: 'string',
            minLength: 1,
        },
    },
};
