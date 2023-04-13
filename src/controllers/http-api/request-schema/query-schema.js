import { QUERY_TYPES, TRIPLE_STORE_REPOSITORIES } from '../../../constants/constants.js';

export default () => ({
    type: 'object',
    required: ['type', 'query'],
    properties: {
        type: {
            enum: [QUERY_TYPES.CONSTRUCT, QUERY_TYPES.SELECT],
        },
        query: {
            type: 'string',
        },
        repository: {
            enum: Object.values(TRIPLE_STORE_REPOSITORIES),
        },
    },
});
