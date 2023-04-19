import { BID_SUGGESTION_OPTIONS } from '../../../constants/constants.js';

export default () => ({
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
            enum: Object.values(BID_SUGGESTION_OPTIONS),
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
            enum: Object.values(BID_SUGGESTION_OPTIONS),
            default: BID_SUGGESTION_OPTIONS.MEDIUM,
        },
    },
});
