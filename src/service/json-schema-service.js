import path from 'path';
import appRootPath from 'app-root-path';

class JsonSchemaService {
    constructor(ctx) {
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async loadSchema(version, schemaName) {
        const schemaPath = path.resolve(
            appRootPath.path,
            `src/controllers/http-api/${version}/request-schema/${schemaName}-schema-${version}.js`,
        );
        const schemaModule = await import(schemaPath);
        const schemaFunction = schemaModule.default;

        if (schemaFunction.length >= 1) {
            return schemaFunction(this.blockchainModuleManager.getImplementationNames());
        }

        return schemaFunction();
    }

    async bidSuggestionSchema(version) {
        return this.loadSchema(version, 'bid-suggestion');
    }

    async publishSchema(version) {
        return this.loadSchema(version, 'publish');
    }

    async updateSchema(version) {
        return this.loadSchema(version, 'update');
    }

    async getSchema(version) {
        return this.loadSchema(version, 'get');
    }

    async querySchema(version) {
        return this.loadSchema(version, 'query');
    }

    async localStoreSchema(version) {
        return this.loadSchema(version, 'local-store');
    }
}

export default JsonSchemaService;
