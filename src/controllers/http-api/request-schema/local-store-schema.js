export default () => ({
    type: 'array',
    items: {
        type: 'object',
        required: ['assertionId', 'assertion'],
        properties: {
            assertionId: {
                type: 'string',
                minLength: 66,
                maxLength: 66,
            },
            assertion: {
                type: 'array',
                items: {
                    type: 'string',
                },
                minItems: 1,
            },
        },
    },
    minItems: 1,
});
