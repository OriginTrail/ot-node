export default (argumentsObject) => ({
    type: 'object',
    required: ['assertionId', 'assertions', 'blockchain', 'contract', 'tokenId', 'paranetId'],
    properties: {
        assertionId: {
            type: 'string',
            minLength: 66,
            maxLength: 66,
        },
        assertions: {
            type: 'array',
            items: {
                type: 'string',
            },
            minItems: 1,
        },
        blockchain: {
            enum: argumentsObject.blockchainImplementationNames,
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
        hashFunctionId: {
            type: 'number',
            minimum: 1,
        },
        // TODO: Check if this is fixed lenght
        paranetId: {
            type: 'string',
        },
    },
});
