const publishSchema = require('../controller/v1/request-schema/publish-schema');
const getSchema = require('../controller/v1/request-schema/get-schema');
const searchSchema = require('../controller/v1/request-schema/search-schema');
const querySchema = require('../controller/v1/request-schema/query-request');

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
        return querySchema;
    }
}

module.exports = JsonSchemaService;
