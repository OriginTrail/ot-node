const errors = require('restify-errors');
const ObjectValidator = require('./object-validator');

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
        const error = ObjectValidator.validateSearchQueryObject(query);
        if (error) {
            return new errors.BadRequestError(error.message);
        }
        return null;
    }

    /**
     * Validate body exists
     * @param query
     * @returns {*}
     */
    static validateNotEmptyQuery(query) {
        if (query == null || Object.keys(query).length === 0) {
            return new errors.BadRequestError('Query is missing');
        }
        return null;
    }
}

module.exports = RestApiValidator;
