import { GET_STATES } from '../../../../constants/constants.js';

export default () => ({
    type: 'object',
    required: ['id'],
    properties: {
        id: {
            type: 'string',
        },
        state: {
            oneOf: [
                { enum: [GET_STATES.LATEST, GET_STATES.FINALIZED] },
                {
                    type: 'string',
                    pattern: '^0x[A-Fa-f0-9]{64}$',
                },
            ],
        },
        hashFunctionId: {
            type: 'number',
            minimum: 1,
        },
        paranetaUAL: {
            type: 'string',
            pattern: '^did:dkg:[^/]+/0x[0-9a-fA-F]{40}/[1-9][0-9]*$',
        },
    },
});
