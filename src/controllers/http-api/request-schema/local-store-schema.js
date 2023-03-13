import { LOCAL_STORE_TYPES } from '../../../constants/constants.js';

export default (blockchainImplementationNames) => ({
    type: 'array',
    items: {
        type: 'object',
        required: ['assertionId', 'assertion'],
        properties: {
            assertionId: {
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
                enum: blockchainImplementationNames,
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
            storeType: {
                type: {
                    enum: [LOCAL_STORE_TYPES.TRIPLE, LOCAL_STORE_TYPES.PENDING],
                },
            },
        },
    },
    minItems: 1,
    maxItems: 2,
});
