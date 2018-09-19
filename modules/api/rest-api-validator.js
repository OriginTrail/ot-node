const errors = require('restify-errors');

/**
 * Static methods used for various REST API calls validation
 */
class RestApiValidator {
    /**
     * Validate body exists
     * @param body
     * @returns {*}
     */
    static validateBodyRequired(body) {
        if (body == null) {
            return new errors.BadRequestError('Body is missing');
        }
        return null;
    }

    /**
     * Validate search query [{PATH, VALUE, OPCODE}*]
     * @param query
     */
    static validateSearchQuery(query) {
        if (query == null) {
            return new errors.BadRequestError('Search query parameter missing');
        }
        if (!Array.isArray(query)) {
            return new errors.BadRequestError('Invalid search query format. Required format is [{PATH, VALUE, OPCODE}*]');
        }
        for (const subquery of query) {
            const { path, value, opcode } = subquery;
            if (path == null) {
                return new errors.BadRequestError('PATH parameter missing');
            }
            if (typeof path !== 'string') {
                return new errors.BadRequestError('PATH parameter is not a string');
            }
            if (value == null) {
                return new errors.BadRequestError('VALUE parameter missing');
            }
            if (opcode == null) {
                return new errors.BadRequestError('OPCODE parameter missing');
            }
            if (typeof opcode !== 'string') {
                return new errors.BadRequestError('OPCODE parameter is not a string');
            }
            if (!['EQ', 'IN'].includes(opcode.toUpperCase())) {
                return new errors.BadRequestError(`OPCODE value ${opcode} not supported. Supported values are [EQ, IN]`);
            }
        }
        return null;
    }
}

module.exports = RestApiValidator;
