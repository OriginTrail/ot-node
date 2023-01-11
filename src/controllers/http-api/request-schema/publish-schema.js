export default (blockchainImplementationNames) => ({
    type: 'object',
    required: ['assertionId', 'assertion', 'blockchain', 'contract', 'tokenId'],
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
        blockchain: {
            enum: blockchainImplementationNames,
        },
        contract: {
            type: 'string',
            minLength: 1,
        },
        tokenId: {
            type: 'number',
            minimum: 0,
        },
    },
});
