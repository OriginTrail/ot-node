export default (blockchainImplementationNames, bidSuggestionOptions) => ({
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
            type: 'number',
            minimum: 1,
        },
        assertionSize: {
            type: 'number',
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
            type: 'number',
            minimum: 1,
            maximum: 1,
        },
        option: {
            enum: bidSuggestionOptions,
            default: bidSuggestionOptions.MEDIUM,
        },
    },
});
