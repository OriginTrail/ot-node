import publishSchema from '../controllers/http-api/v1.0.0/request-schema/publish-schema.js';
import getSchema from '../controllers/http-api/v1.0.0/request-schema/get-schema.js';
import searchSchema from '../controllers/http-api/v1.0.0/request-schema/search-schema.js';
import querySchema from '../controllers/http-api/v1.0.0/request-schema/query-schema.js';

class JsonSchemaService {
    constructor(ctx) {
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    publishSchema() {
        return publishSchema(this.blockchainModuleManager.getImplementationsNames());
    }

    getSchema() {
        return getSchema();
    }

    searchSchema() {
        return searchSchema();
    }

    querySchema() {
        return querySchema();
    }
}

export default JsonSchemaService;
