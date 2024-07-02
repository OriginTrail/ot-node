export default (argumentsObject) => ({
    type: 'array',
    items: {
        type: 'object',
        required: ['merkleRoot', 'assertions'],
        properties: {
            merkleRoot: {
                type: 'string',
                minLength: 66,
                maxLength: 66,
            },
            knowledgeAssets: {
                type: 'array',
                items: {
                    assertionId: 'string',
                    assertion: 'array',
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
        },
    },
    minItems: 1,
    maxItems: 2,
});
