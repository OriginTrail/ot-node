const { QUERY_TYPES } = require('../../../constants/constants');

module.exports = {
    type: 'object',
    required: ['type', 'query'],
    properties: {
        type: {
            enum: [QUERY_TYPES.CONSTRUCT, QUERY_TYPES.SELECT],
        },
        query: {
            type: 'string',
        },
    },
};
