import path from 'path';
import appRootPath from 'app-root-path';

class JsonSchemaService {
    constructor(ctx) {
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async loadSchema(version, schemaName, argumentsObject = {}) {
        const schemaPath = path.resolve(
            appRootPath.path,
            `src/controllers/http-api/${version}/request-schema/${schemaName}-schema-${version}.js`,
        );
        const schemaModule = await import(schemaPath);
        const schemaFunction = schemaModule.default;

        if (schemaFunction.length !== 0) {
            return schemaFunction(argumentsObject);
        }

        return schemaFunction();
    }

    async bidSuggestionSchema(version, argumentsObject = {}) {
        return this.loadSchema(version, 'bid-suggestion', argumentsObject);
    }

    async publishSchema(version, argumentsObject = {}) {
        return this.loadSchema(version, 'publish', argumentsObject);
    }

    async updateSchema(version, argumentsObject = {}) {
        return this.loadSchema(version, 'update', argumentsObject);
    }

    async getSchema(version, argumentsObject = {}) {
        return this.loadSchema(version, 'get', argumentsObject);
    }

    async querySchema(version, argumentsObject = {}) {
        return this.loadSchema(version, 'query', argumentsObject);
    }

    async localStoreSchema(version, argumentsObject = {}) {
        return this.loadSchema(version, 'local-store', argumentsObject);
    }
}

export default JsonSchemaService;
