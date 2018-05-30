/**
 * SearchResponse model
 */
class SearchResponse {
    /**
     * Default constructor
     * @param imports
     */
    constructor(imports = []) {
        this.imports = new Set(imports);
    }

    /**
     * Add import to the response
     * @param importId
     */
    add(importId) {
        this.imports.add(importId);
    }

    /**
     * Gets import IDs
     * @return {*|Array}
     */
    getImports() {
        return [...this.imports];
    }

    /**
     * Serializes response object
     * @param response  SearchResponse object
     * @return {string}
     */
    static serialize(response) {
        return JSON.stringify({
            imports: response.getImports(),
        });
    }

    /**
     * Deserializes response text
     * @param responseText  SearchResponse text
     * @return {SearchResponse}
     */
    static deserialize(responseText) {
        const obj = JSON.parse(responseText);
        return new SearchResponse(obj.imports);
    }
}

module.exports = SearchResponse;
