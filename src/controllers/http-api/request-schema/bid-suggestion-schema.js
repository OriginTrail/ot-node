export default (blockchainImplementationNames) => ({
    type: 'object',
    required: [
        'blockchain',
        'epochsNumber',
        'assertionSize',
        'contentAssetStorageAddress',
        'firstAssertionId',
        'hashFunctionId',
    ],
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
            minLength: 42,
            maxLength: 42,
        },
        firstAssertionId: {
            type: 'string',
            minLength: 66,
            maxLength: 66,
        },
        hashFunctionId: {
            type: 'integer',
            minimum: 1,
        },
    },
});
