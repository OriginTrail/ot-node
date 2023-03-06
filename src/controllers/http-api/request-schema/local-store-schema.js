import { LOCAL_STORE_TYPES } from '../../../constants/constants.js';

export default () => ({
    type: 'object',
    required: ['assertions'],
    properties: {
        assertions: {
            type: 'array',
            items: {
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
            },
            minItems: 1,
        },
        storeType: {
            type: {
                enum: [LOCAL_STORE_TYPES.TRIPLE, LOCAL_STORE_TYPES.PENDING],
            },
        },
    },
});
