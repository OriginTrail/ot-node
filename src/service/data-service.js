import { kcTools } from 'assertion-tools';
import { XML_DATA_TYPES } from '../constants/constants.js';

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    createTripleAnnotations(groupedTriples, annotationPredicate, annotations) {
        return groupedTriples.flatMap((knowledgeAssetTriples, index) =>
            knowledgeAssetTriples.map(
                (triple) =>
                    `<< ${triple.replace(' .', '')} >> ${annotationPredicate} ${
                        annotations[index]
                    } .`,
            ),
        );
    }

    countDistinctSubjects(triples) {
        return kcTools.countDistinctSubjects(triples);
    }

    groupTriplesBySubject(triples, sort = true) {
        return kcTools.groupNquadsBySubject(triples, sort);
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
}

export default DataService;
