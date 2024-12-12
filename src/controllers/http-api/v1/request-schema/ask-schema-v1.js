export default () => ({
    type: 'object',
    required: ['ual', 'blockchain', 'minimumNumberOfNodeReplications'],
    properties: {
        ual: {
            oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }],
        },
        blockchain: {
            type: 'string',
        },
        minimumNumberOfNodeReplications: {
            type: 'number',
            minimum: 0,
        },
    },
});
