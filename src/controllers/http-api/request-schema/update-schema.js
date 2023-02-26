export default (blockchainImplementationNames) => ({
    type: 'object',
    required: ['assertionData', 'blockchain', 'contract', 'tokenId'],
    properties: {
        assertionData: {
            type: 'object',
            required: ['publicAssertion', 'publicAssertionId'],
            properties: {
                publicAssertionId: {
                    type: 'string',
                    minLength: 66,
                    maxLength: 66,
                },
                publicAssertion: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                    minItems: 1,
                },
            },
        },
        blockchain: {
            enum: blockchainImplementationNames,
        },
        contract: {
            type: 'string',
            minLength: 42,
            maxLength: 42,
        },
        tokenId: {
            type: 'number',
            minimum: 0,
        },
    },
});
