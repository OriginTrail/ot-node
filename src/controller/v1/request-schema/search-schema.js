export default () => ({
    type: 'object',
    required: ['keywords', 'limit', 'offset'],
    properties: {
        keywords: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
        },
        limit: {
            type: 'integer',
            minimum: 1,
        },
        offset: {
            type: 'integer',
            minimum: 0,
        },
    },
});
