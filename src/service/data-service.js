const jsonld = require('jsonld');

const { SCHEMA_CONTEXT } = require('../constants/constants');
const { DATA_TYPES } = require('../modules/triple-store/implementation/triple-store-constants');

const ALGORITHM = 'URDNA2015';

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    async toNQuads(content, inputFormat) {
        const options = {
            algorithm: ALGORITHM,
            format: DATA_TYPES.N_QUADS,
        };

        if (inputFormat) {
            options.inputFormat = inputFormat;
        }

        const canonized = await jsonld.canonize(content, options);

        return canonized.split('\n').filter((x) => x !== '');
    }

    async compact(content) {
        const result = await jsonld.compact(content, {
            '@context': SCHEMA_CONTEXT,
        });

        return result;
    }

    async canonize(content) {
        const nquads = await this.toNQuads(content);
        if (nquads && nquads.length === 0) {
            throw new Error('File format is corrupted, no n-quads extracted.');
        }

        return nquads;
    }

    /**
     * Transforms bindings string to developer friendly key-value JSON
     * @param bindings
     * @returns {*[]}
     */
    bindingsToJSON(bindings) {
        const jsonBindings = JSON.parse(bindings);
        return this._parseBindings(jsonBindings.results.bindings);
    }

    /**
     * Returns bindings in more developer friendly (key-value) form
     * @param bindings
     * @returns {*[]}
     * @private
     */
    _parseBindings(bindings) {
        const json = [];

        for (const row of bindings) {
            const obj = {};
            for (const columnName in row) {
                obj[columnName] = this._parseBindingData(row[columnName]);
            }
            json.push(obj);
        }

        return json;
    }

    /**
     * Returns cast binding value based on datatype
     * @param data
     * @returns {boolean|number|string}
     * @private
     */
    _parseBindingData(data) {
        switch (data.datatype) {
            case 'http://www.w3.org/2001/XMLSchema#decimal':
            case 'http://www.w3.org/2001/XMLSchema#float':
            case 'http://www.w3.org/2001/XMLSchema#double':
                return parseFloat(data.value);
            case 'http://www.w3.org/2001/XMLSchema#integer':
                return parseInt(data.value, 10);
            case 'http://www.w3.org/2001/XMLSchema#boolean':
                return data.value === 'true';
            default:
                return data.value;
        }
    }
}

module.exports = DataService;
