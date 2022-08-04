const OperationService = require('./operation-service');
const { OPERATION_ID_STATUS, QUERY_TYPES } = require('../constants/constants');

class QueryService extends OperationService {
    constructor(ctx) {
        super(ctx);
        this.operationName = 'query';
        this.operationStatus = OPERATION_ID_STATUS.QUERY;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.dataService = ctx.dataService;
    }

    async query(query, queryType) {
        switch (queryType) {
            case QUERY_TYPES.CONSTRUCT:
                return this.constructQuery(query);
            case QUERY_TYPES.SELECT:
                return this.selectQuery(query);
            default:
                throw new Error(`Unknown query type ${queryType}`);
        }
    }

    constructQuery(query) {
        return this.tripleStoreModuleManager.construct(query);
    }

    async selectQuery(query) {
        const bindings = await this.tripleStoreModuleManager.select(query);
        return this.dataService.parseBindings(bindings);
    }
}

module.exports = QueryService;
