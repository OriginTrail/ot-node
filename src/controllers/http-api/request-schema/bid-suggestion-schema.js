export default (blockchainImplementationNames) => ({
    type: 'object',
    required: ['blockchain', 'contract', 'tokenId', 'hashFunctionId'],
    properties: {
        blockchain: {
            enum: blockchainImplementationNames,
        },
        contract: {
            type: 'string',
            minLength: 1,
        },
        tokenId: {
            type: 'integer',
            minimum: 0,
        },
        hashFunctionId: {
            type: 'integer',
            minimum: 0,
        },
    },
});
