import publishSchema from '../controllers/http-api/request-schema/publish-schema.js';
import updateSchema from '../controllers/http-api/request-schema/update-schema.js';
import getSchema from '../controllers/http-api/request-schema/get-schema.js';
import querySchema from '../controllers/http-api/request-schema/query-schema.js';
import bidSuggestionSchema from '../controllers/http-api/request-schema/bid-suggestion-schema.js';
import localStoreSchema from '../controllers/http-api/request-schema/local-store-schema.js';
import { BID_SUGGESTION_OPTIONS } from '../constants/constants.js';

class JsonSchemaService {
    constructor(ctx) {
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    bidSuggestionSchema() {
        return bidSuggestionSchema(
            this.blockchainModuleManager.getImplementationNames(),
            Object.values(BID_SUGGESTION_OPTIONS),
        );
    }

    publishSchema() {
        return publishSchema(this.blockchainModuleManager.getImplementationNames());
    }

    updateSchema() {
        return updateSchema(this.blockchainModuleManager.getImplementationNames());
    }

    getSchema() {
        return getSchema();
    }

    querySchema() {
        return querySchema();
    }

    localStoreSchema() {
        return localStoreSchema(this.blockchainModuleManager.getImplementationNames());
    }
}

export default JsonSchemaService;
