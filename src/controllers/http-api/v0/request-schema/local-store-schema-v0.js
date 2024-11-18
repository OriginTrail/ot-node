import { LOCAL_STORE_TYPES } from '../../../../constants/constants.js';

export default (argumentsObject) => ({
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
            storeType: {
                type: {
                    enum: [
                        LOCAL_STORE_TYPES.TRIPLE,
                        LOCAL_STORE_TYPES.TRIPLE_PARANET,
                        LOCAL_STORE_TYPES.PENDING,
                    ],
                },
            },
            paranetUAL: {
                type: 'string',
            },
            filePath: {
                type: 'string',
            },
        },
    },
    minItems: 1,
    maxItems: 2,
});
