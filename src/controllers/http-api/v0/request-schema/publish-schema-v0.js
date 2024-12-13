export default (argumentsObject) => ({
    type: 'object',
    required: ['assertionMerkleRoot', 'assertion', 'blockchain', 'contract', 'tokenId'],
    properties: {
        assertionMerkleRoot: {
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
    },
});
