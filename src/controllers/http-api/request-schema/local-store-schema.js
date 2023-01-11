export default () => ({
    type: 'object',
    required: ['assertionId', 'assertion', 'repositories'],
    properties: {
        assertionId: {
            type: 'string',
            minLength: '1',
        },
        assertion: {
            type: 'array',
            items: {
                type: 'string',
            },
            minItems: 1,
        },
    },
});
