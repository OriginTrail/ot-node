const { HTTP_API_ROUTES } = require('../constants/constants');

// const supportedVersion = 'v1';

class HttpApiRouter {
    constructor(ctx) {
        this.config = ctx.config;
        this.fileSystemModule = ctx.fileSystemModule;
        this.httpClientModule = ctx.httpClientModule;

        this.resolveController = ctx.resolveController;
        this.publishController = ctx.publishController;
        this.searchController = ctx.searchController;
        this.resultController = ctx.resultController;
        this.infoController = ctx.infoController;
    }

    async initialize() {
        await this.initializeMiddleware();
        await this.initializeSsl();
        await this.initializeListeners();
    }

    async initializeListeners() {
        // POST REQUESTS
        this.httpClientModule.post(HTTP_API_ROUTES.PUBLISH, (req, res) => {
            this.publishController.handleHttpApiPublishRequest(req, res);
        });

        this.httpClientModule.post(HTTP_API_ROUTES.PROVISION, (req, res) => {
            this.publishController.handleHttpApiProvisionRequest(req, res);
        });

        this.httpClientModule.post(HTTP_API_ROUTES.UPDATE, (req, res) => {
            this.publishController.handleHttpApiUpdateRequest(req, res);
        });

        this.httpClientModule.post(HTTP_API_ROUTES.QUERY, (req, res) => {
            this.searchController.handleHttpApiQueryRequest(req, res);
        });

        this.httpClientModule.post(HTTP_API_ROUTES.PROOFS, (req, res) => {
            this.searchController.handleHttpApiProofsRequest(req, res);
        });

        // GET REQUESTS
        this.httpClientModule.get(HTTP_API_ROUTES.RESOLVE, (req, res) => {
            this.resolveController.handleHttpApiResolveRequest(req, res);
        });

        this.httpClientModule.get(HTTP_API_ROUTES.SEARCH_ASSERTIONS, (req, res) => {
            this.searchController.handleHttpApiSearchAssertionsRequest(req, res);
        });

        this.httpClientModule.get(HTTP_API_ROUTES.SEARCH_ENTITIES, (req, res) => {
            this.searchController.handleHttpApiSearchEntitiesRequest(req, res);
        });

        this.httpClientModule.get(HTTP_API_ROUTES.OPERATION_RESULT, (req, res) => {
            this.resultController.handleHttpApiOperationResultRequest(req, res);
        });

        this.httpClientModule.get(HTTP_API_ROUTES.INFO, (req, res) => {
            this.infoController.handleHttpApiInfoRequest(req, res);
        });
    }

    async initializeMiddleware() {
        this.middleware = {};
    }

    async initializeSsl() {
        return false;
    }
}

module.exports = HttpApiRouter;
