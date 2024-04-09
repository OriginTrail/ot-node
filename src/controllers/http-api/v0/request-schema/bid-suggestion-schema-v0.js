import { BID_SUGGESTION_RANGE_ENUM } from '../../../../constants/constants';

export default (argumentsObject) => ({
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
            enum: argumentsObject.blockchainImplementationNames,
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
        proximityScoreFunctionsPairId: {
            type: 'number',
            minimum: 1,
            maximum: 2,
        },
        bidSuggestionRange: {
            type: 'string',
            enum: BID_SUGGESTION_RANGE_ENUM,
        },
    },
});
