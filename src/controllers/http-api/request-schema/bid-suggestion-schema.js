export default (blockchainImplementationNames) => ({
    type: 'object',
    required: ['blockchain', 'epochsNumber', 'assertionSize'],
    properties: {
        blockchain: {
            enum: blockchainImplementationNames,
        },
        epochsNumber: {
            type: 'integer',
            minimum: 0,
        },
        assertionSize: {
            type: 'integer',
            minimum: 0,
        },
    },
});
