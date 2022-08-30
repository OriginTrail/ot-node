import { PUBLISH_TYPES } from '../../../constants/constants.js';

const assertionSchemaProperties = (blockchainImplementationNames) => ({
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
        enum: blockchainImplementationNames,
    },
    contract: {
        type: 'string',
        minLength: 1,
    },
});

const assertionSchemaRequired = ['assertionId', 'assertion', 'blockchain', 'contract'];

const assetSchemaProperties = (blockchainImplementationNames) => ({
    ...assertionSchemaProperties(blockchainImplementationNames),
    tokenId: {
        type: 'integer',
        minimum: 0,
    },
});

const assetSchemaRequired = [...assertionSchemaRequired, 'tokenId'];

const indexSchemaProperties = (blockchainImplementationNames) => ({
    ...assetSchemaProperties(blockchainImplementationNames),
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
});

const indexSchemaRequired = [...assetSchemaRequired, 'keywords'];

const publishSchema = (blockchainImplementationNames) => ({
    type: 'object',
    required: ['publishType'],
    properties: {
        publishType: {
            enum: Object.values(PUBLISH_TYPES),
        },
    },
    allOf: [
        {
            if: {
                properties: { publishType: { const: PUBLISH_TYPES.ASSERTION } },
            },
            then: {
                properties: assertionSchemaProperties(blockchainImplementationNames),
                required: assertionSchemaRequired,
            },
        },
        {
            if: {
                properties: { publishType: { const: PUBLISH_TYPES.ASSET } },
            },
            then: {
                properties: assetSchemaProperties(blockchainImplementationNames),
                required: assetSchemaRequired,
            },
        },
        {
            if: {
                properties: { publishType: { const: PUBLISH_TYPES.INDEX } },
            },
            then: {
                properties: indexSchemaProperties(blockchainImplementationNames),
                required: indexSchemaRequired,
            },
        },
    ],
});

export default publishSchema;
