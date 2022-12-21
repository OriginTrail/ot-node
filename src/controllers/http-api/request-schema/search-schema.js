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
            type: 'number',
            minimum: 1,
        },
        offset: {
            type: 'number',
            minimum: 0,
        },
    },
});
