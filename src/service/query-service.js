import { QUERY_TYPES, TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

class QueryService {
    constructor(ctx) {
        this.tripleStoreService = ctx.tripleStoreService;
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
        return this.tripleStoreService.construct(TRIPLE_STORE_REPOSITORIES.CURRENT, query);
    }

    async selectQuery(query) {
        const bindings = await this.tripleStoreService.select(
            TRIPLE_STORE_REPOSITORIES.CURRENT,
            query,
        );
        return this.dataService.parseBindings(bindings);
    }
}

export default QueryService;
