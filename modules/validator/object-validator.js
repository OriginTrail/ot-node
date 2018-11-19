/**
 * Static methods used for various REST API calls validation
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
}

module.exports = ObjectValidator;
