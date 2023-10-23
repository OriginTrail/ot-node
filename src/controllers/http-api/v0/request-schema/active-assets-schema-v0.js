export default () => ({
    type: 'object',
    required: ['assertionId', 'assertion', 'blockchain', 'contract', 'tokenId'],
    properties: {
        blockchainId: {
            type: 'string',
        },
    },
});
