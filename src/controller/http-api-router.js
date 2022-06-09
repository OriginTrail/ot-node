const publishRequest = require('./v1/request-schema/publish-request');

class HttpApiRouter {
    constructor(ctx) {
        this.config = ctx.config;
        this.httpClientModuleManager = ctx.httpClientModuleManager;

        this.resolveController = ctx.resolveController;
        this.publishController = ctx.publishController;
        this.searchController = ctx.searchController;
        this.resultController = ctx.resultController;
        this.infoController = ctx.infoController;
    }

    async initialize() {
        await this.initializeListeners();
        await this.initializeMiddleware();
        await this.httpClientModuleManager.listen();
    }

    async initializeListeners() {
        // POST REQUESTS
        this.httpClientModuleManager.post('/publish', publishRequest, (req, res) => {
            this.publishController.handleHttpApiPublishRequest(req, res);
        });

        this.httpClientModuleManager.post('/provision', (req, res) => {
            this.publishController.handleHttpApiProvisionRequest(req, res);
        });

        this.httpClientModuleManager.post('/update', (req, res) => {
            this.publishController.handleHttpApiUpdateRequest(req, res);
        });
        //
        // this.httpClientModuleManager.post(HTTP_API_ROUTES.QUERY, (req, res) => {
        //     this.searchController.handleHttpApiQueryRequest(req, res);
        // });
        //
        // this.httpClientModuleManager.post(HTTP_API_ROUTES.PROOFS, (req, res) => {
        //     this.searchController.handleHttpApiProofsRequest(req, res);
        // });
        //
        // // GET REQUESTS
        // this.httpClientModuleManager.get(HTTP_API_ROUTES.RESOLVE, (req, res) => {
        //     this.resolveController.handleHttpApiResolveRequest(req, res);
        // });
        //
        // this.httpClientModuleManager.get(HTTP_API_ROUTES.SEARCH_ASSERTIONS, (req, res) => {
        //     this.searchController.handleHttpApiSearchAssertionsRequest(req, res);
        // });
        //
        // this.httpClientModuleManager.get(HTTP_API_ROUTES.SEARCH_ENTITIES, (req, res) => {
        //     this.searchController.handleHttpApiSearchEntitiesRequest(req, res);
        // });
        //
        this.httpClientModuleManager.get('/:operation/result/:handler_id', (req, res) => {
            this.resultController.handleHttpApiOperationResultRequest(req, res);
        });

        this.httpClientModuleManager.get('/info', (req, res) => {
            this.infoController.handleHttpApiInfoRequest(req, res);
        });
    }

    async initializeMiddleware() {
        await this.httpClientModuleManager.initializeMiddleware();
        // this.middleware = {};
    }
}

module.exports = HttpApiRouter;
