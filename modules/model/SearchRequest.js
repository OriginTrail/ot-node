const { Enum } = require('enumify');

/**
 * Describes search operation for the property
 */
class OPCODE extends Enum {
}

OPCODE.initEnum(['IN', 'EQ']);

/**
 * SearchRequest model
 */
class SearchRequest {
    /**
     * Default constructor
     */
    constructor() {
        this.parts = [];
    }

    /**
     * Adds single query part
     * @param searchPath  Flattened property included in search
     * @param searchValue Searched value
     * @param opcode      Search OPCODE
     */
    add(searchPath, searchValue, opcode) {
        this.parts.push([searchPath, searchValue, opcode.name]);
    }

    /**
     * Serializes data for network transfer
     * @param request SearchRequest object
     * @return {string}
     */
    static serialize(request) {
        return JSON.stringify(request);
    }

    /**
     * Deserializes text into SearchRequest
     * @param requestText SearchRequest text
     */
    static deserialize(requestText) {
        const obj = JSON.parse(requestText);
        const request = new SearchRequest();
        for (const part of obj.parts) {
            request.add(part[0], part[1], OPCODE.enumValueOf(part[2]));
        }
        return request;
    }
}

module.exports = SearchRequest;
