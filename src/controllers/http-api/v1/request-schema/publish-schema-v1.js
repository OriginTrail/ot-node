export default (argumentsObject) => ({
    type: 'object',
    required: ['assertionMerkleRoot', 'assertion', 'blockchain'],
    properties: {
        assertionMerkleRoot: {
            type: 'string',
            minLength: 66,
            maxLength: 66,
        },
        assertion: {
            type: 'object',
            properties: {
                public: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                    minItems: 1,
                },
                private: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            },
            required: ['public'],
            additionalProperties: false,
        },
        blockchain: {
            enum: argumentsObject.blockchainImplementationNames,
        },
    },
});
