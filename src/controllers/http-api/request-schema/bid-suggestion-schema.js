export default (blockchainImplementationNames) => ({
    type: 'object',
    required: ['blockchain', 'epochsNumber', 'assertionSize'],
    properties: {
        blockchain: {
            enum: blockchainImplementationNames,
        },
        epochsNumber: {
            type: 'integer',
            minimum: 1,
        },
        assertionSize: {
            type: 'integer',
            minimum: 1,
        },
        contentAssetStorageAddress: {
            type: 'string',
            length: 42,
        },
        firstAssertionId: {
            type: 'string',
            length: 66,
        },
        hashFunctionId: {
            type: 'integer',
            minimum: 1,
        },
    },
});
