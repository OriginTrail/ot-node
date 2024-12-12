export default (argumentsObject) => ({
    type: 'object',
    required: ['ual', 'blockchain', 'minimumNumberOfNodeReplications'],
    properties: {
        ual: {
            oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }],
        },
        blockchain: {
            enum: argumentsObject.blockchainImplementationNames,
        },
        minimumNumberOfNodeReplications: {
            type: 'number',
            minimum: 0,
        },
    },
});
