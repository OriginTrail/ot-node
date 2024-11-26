import jsonld from 'jsonld';
import toNQuadsWorker from '../workers/data-service-toNQuads-worker.js';
import {
    SCHEMA_CONTEXT,
    MEDIA_TYPES,
    XML_DATA_TYPES,
    PRIVATE_ASSERTION_PREDICATE,
} from '../constants/constants.js';

const ALGORITHM = 'URDNA2015';

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    async toNQuads(content, inputFormat) {
        const options = {
            algorithm: ALGORITHM,
            format: MEDIA_TYPES.N_QUADS,
        };
        if (inputFormat) {
            options.inputFormat = inputFormat;
        }
        return toNQuadsWorker(content, options);
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

    createTripleAnnotations(triples, annotationPredicate, annotation) {
        return triples.map((triple) => `<< ${triple} >> ${annotationPredicate} ${annotation}`);
    }

    countDistinctSubjects(triples) {
        const distinctSubjects = new Set();

        for (const triple of triples) {
            const [subject, ,] = triple.split(' ');

            distinctSubjects.add(subject);
        }

        return distinctSubjects.size;
    }

    groupTriplesBySubject(triples, sort = true) {
        const groupedTriples = {};

        for (const triple of triples) {
            const [subject, ,] = triple.split(' ');
            if (!groupedTriples[subject]) {
                groupedTriples[subject] = [];
            }
            groupedTriples[subject].push(triple);
        }

        let subjects = Object.keys(groupedTriples);
        if (sort) {
            subjects = subjects.sort();
        }

        return subjects.map((subject) => groupedTriples[subject]);
    }

    /**
     * Returns bindings with proper data types
     * @param bindings
     * @returns {*[]}
     */
    parseBindings(bindings = []) {
        const result = [];

        for (const row of bindings) {
            const obj = {};
            for (const columnName in row) {
                obj[columnName] = this._parseBindingDataTypes(row[columnName]);
            }
            result.push(obj);
        }

        return result;
    }

    /**
     * Returns cast binding value based on datatype
     * @param data
     * @returns {boolean|number|string}
     * @private
     */
    _parseBindingDataTypes(data) {
        const [value, dataType] = data.split('^^');

        switch (dataType) {
            case XML_DATA_TYPES.DECIMAL:
            case XML_DATA_TYPES.FLOAT:
            case XML_DATA_TYPES.DOUBLE:
                return parseFloat(JSON.parse(value));
            case XML_DATA_TYPES.INTEGER:
                return parseInt(JSON.parse(value), 10);
            case XML_DATA_TYPES.BOOLEAN:
                return JSON.parse(value) === 'true';
            default:
                return value;
        }
    }

    getPrivateAssertionId(publicAssertion) {
        const privateAssertionLinkTriple = publicAssertion.filter((triple) =>
            triple.includes(PRIVATE_ASSERTION_PREDICATE),
        )[0];
        if (!privateAssertionLinkTriple) return;

        return privateAssertionLinkTriple.match(/"(.*?)"/)[1];
    }
}

export default DataService;
