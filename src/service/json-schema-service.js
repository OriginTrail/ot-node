const getSchema = require('../controller/v1/request-schema/get-schema');
const publishSchema = require('../controller/v1/request-schema/publish-schema');

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
}

module.exports = JsonSchemaService;
