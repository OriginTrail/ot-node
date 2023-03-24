import { GET_STATES } from '../../../constants/constants.js';

export default () => ({
    type: 'object',
    required: ['id'],
    properties: {
        id: {
            type: 'string',
        },
        type: {
            enum: [GET_STATES.LATEST, GET_STATES.LATEST_FINALIZED],
        },
        hashFunctionId: {
            type: 'number',
            minimum: 1,
        },
    },
});
