/**
 * Static methods used for various REST/Kademlia API calls validation
 */
class ObjectValidator {
    /**
     * Validate search query [{PATH, VALUE, OPCODE}*]
     * @param query
     */
    static validateSearchQueryObject(query) {
        if (query == null) {
            return new Error('Search query parameter missing');
        }
        if (!Array.isArray(query)) {
            return new Error('Invalid search query format. Required format is [{PATH, VALUE, OPCODE}*]');
        }
        for (const subquery of query) {
            const { path, value, opcode } = subquery;
            if (path == null) {
                return new Error('PATH parameter missing');
            }
            if (typeof path !== 'string') {
                return new Error('PATH parameter is not a string');
            }
            if (value == null) {
                return new Error('VALUE parameter missing');
            }
            if (opcode == null) {
                return new Error('OPCODE parameter missing');
            }
            if (typeof opcode !== 'string') {
                return new Error('OPCODE parameter is not a string');
            }
            if (!['EQ', 'IN'].includes(opcode.toUpperCase())) {
                return new Error(`OPCODE value ${opcode} not supported. Supported values are [EQ, IN]`);
            }
        }
        return null;
    }

    /**
     * Validate challenge request
     * @param message
     * @return {*}
     */
    static validateChallengeRequest(message) {
        if (message.payload == null) {
            return new Error('Payload is missing');
        }
        const blockId = message.payload.block_id;
        if (blockId == null) {
            return new Error('Block ID is missing');
        }
        const datasetId = message.payload.data_set_id;
        if (datasetId == null) {
            return new Error('Data set ID is missing');
        }
        const challengeId = message.payload.challenge_id;
        if (challengeId == null) {
            return new Error('Challenge ID is missing');
        }
        const litigatorId = message.payload.litigator_id;
        if (litigatorId == null) {
            return new Error('Litigator ID is missing');
        }
        return null;
    }

    /**
     * Validate challenge response
     * @param message
     * @return {*}
     */
    static validateChallengeResponse(message) {
        if (message.payload == null) {
            return new Error('Payload is missing');
        }
        const challengeId = message.payload.challenge_id;
        if (challengeId == null) {
            return new Error('Challenge ID is missing');
        }
        const { answer } = message.payload;
        if (answer == null) {
            return new Error('Answer ID is missing');
        }
        return null;
    }
}

module.exports = ObjectValidator;
