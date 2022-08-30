import publishSchema from '../controller/v1/request-schema/publish-schema.js';
import getSchema from '../controller/v1/request-schema/get-schema.js';
import searchSchema from '../controller/v1/request-schema/search-schema.js';

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
}

export default JsonSchemaService;
