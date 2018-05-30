const uuidv1 = require('uuid/v1');
const { Enum } = require('enumify');

/**
 * Describes search operation for the property
 */
class OPCODE extends Enum {
}

OPCODE.initEnum(['IN', 'EQ']);

class SearchRequest {
    /**
     * Default constructor
     * @param id
     */
    constructor(id) {
        if (id) {
            this.id = id;
        } else {
            this.id = uuidv1();
        }
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
        const request = new SearchRequest(obj.id);
        for (const part of obj.parts) {
            request.add(part[0], part[1], OPCODE.enumValueOf(part[2]));
        }
        return request;
    }
}

module.exports = SearchRequest;