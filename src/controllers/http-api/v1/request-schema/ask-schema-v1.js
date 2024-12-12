export default () => ({
    type: 'object',
    required: ['ual', 'blockchain'],
    properties: {
        ual: {
            oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        },
        blockchain: {
            type: 'string',
        },
        minimumNumberOfNodeReplications: {
            type: 'number',
        },
    },
});
