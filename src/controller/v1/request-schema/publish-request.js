const publishTypes = { ASSERTION: 'assertion', ASSET: 'asset', INDEX: 'index' };
const assertionSchema = {
    assertionId: {
        type: 'string',
        minLength: '1',
    },
    assertion: {
        type: 'array',
        items: {
            type: 'string',
        },
        minItems: 1,
    },
    blockchain: {
        type: 'string',
        minLength: '1',
    },
    contract: {
        type: 'string',
        minLength: 1,
    },
};
const assertionRequiredKeys = ['assertion_id', 'assertion', 'blockchain', 'contract'];

module.exports = {
    type: 'object',
    required: ['assertion_id', 'assertion'],
    properties: {
        publishType: {
            enum: [publishTypes.ASSERTION, publishTypes.ASSET, publishTypes.INDEX],
        },
    },
    allOf: [
        {
            if: {
                properties: { publishType: { const: publishTypes.ASSERTION } },
            },
            then: {
                properties: {
                    ...assertionSchema,
                },
                required: assertionRequiredKeys,
            },
        },
        {
            if: {
                properties: { publishType: { const: publishTypes.ASSET } },
            },
            then: {
                properties: {
                    ...assertionSchema,
                    tokenId: {
                        type: 'integer',
                        minimum: 0,
                    },
                },
                required: [...assertionRequiredKeys, 'tokenId'],
            },
        },
        {
            if: {
                properties: { publishType: { const: publishTypes.INDEX } },
            },
            then: {
                properties: {
                    ...assertionSchema,
                    assertion: {
                        type: 'array',
                        items: {
                            type: 'string',
                        },
                        minLength: 1,
                        maxLength: 5,
                    },
                    keywords: {
                        type: 'array',
                        minLength: 1,
                        maxLength: 3,
                        uniqueItems: true,
                    },
                },
                required: [...assertionRequiredKeys, 'keywords'],
            },
        },
    ],
};
