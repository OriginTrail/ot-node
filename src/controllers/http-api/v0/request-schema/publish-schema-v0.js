export default (argumentsObject) => ({
    type: 'object',
    required: ['assertionId', 'assertion', 'blockchain', 'contract', 'tokenId'],
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
        blockchain: {
            enum: argumentsObject.blockchainImplementationNames,
        },
        hashFunctionId: {
            type: 'number',
            minimum: 1,
        },
    },
});
