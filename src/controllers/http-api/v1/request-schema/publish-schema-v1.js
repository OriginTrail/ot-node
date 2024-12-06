export default (argumentsObject) => ({
    type: 'object',
    required: ['datasetRoot', 'dataset', 'blockchain'],
    properties: {
        datasetRoot: {
            type: 'string',
            minLength: 66,
            maxLength: 66,
        },
        dataset: {
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
