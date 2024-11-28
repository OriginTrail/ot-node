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

    async bidSuggestionSchema(version) {
        const schemaArgs = {};

        switch (version) {
            case 'v0':
                schemaArgs.blockchainImplementationNames =
                    this.blockchainModuleManager.getImplementationNames();
                break;
            default:
                throw Error(`HTTP API version: ${version} isn't supported.`);
        }

        return this.loadSchema(version, 'bid-suggestion', schemaArgs);
    }

    async publishSchema(version) {
        const schemaArgs = {};

        switch (version) {
            case 'v0':
                schemaArgs.blockchainImplementationNames =
                    this.blockchainModuleManager.getImplementationNames();
                break;
            default:
                throw Error(`HTTP API version: ${version} isn't supported.`);
        }

        return this.loadSchema(version, 'publish', schemaArgs);
    }

    async updateSchema(version) {
        const schemaArgs = {};

        switch (version) {
            case 'v0':
                schemaArgs.blockchainImplementationNames =
                    this.blockchainModuleManager.getImplementationNames();
                break;
            default:
                throw Error(`HTTP API version: ${version} isn't supported.`);
        }

        return this.loadSchema(version, 'update', schemaArgs);
    }

    async getSchema(version) {
        const schemaArgs = {};

        switch (version) {
            case 'v0':
            case 'v1':
                break;
            default:
                throw Error(`HTTP API version: ${version} isn't supported.`);
        }

        return this.loadSchema(version, 'get', schemaArgs);
    }

    async querySchema(version) {
        const schemaArgs = {};

        switch (version) {
            case 'v0':
                break;
            default:
                throw Error(`HTTP API version: ${version} isn't supported.`);
        }

        return this.loadSchema(version, 'query', schemaArgs);
    }

    async localStoreSchema(version) {
        const schemaArgs = {};

        switch (version) {
            case 'v0':
                schemaArgs.blockchainImplementationNames =
                    this.blockchainModuleManager.getImplementationNames();
                break;
            default:
                throw Error(`HTTP API version: ${version} isn't supported.`);
        }

        return this.loadSchema(version, 'local-store', schemaArgs);
    }
}

export default JsonSchemaService;
