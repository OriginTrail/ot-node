class HttpApiRouter {
    constructor(ctx) {
        this.config = ctx.config;
        this.httpClientModuleManager = ctx.httpClientModuleManager;

        this.getController = ctx.getController;
        this.publishController = ctx.publishController;
        this.searchController = ctx.searchController;
        this.resultController = ctx.resultController;
        this.infoController = ctx.infoController;

        this.jsonSchemaService = ctx.jsonSchemaService;
    }

    async initialize() {
        await this.initializeListeners();
        await this.httpClientModuleManager.listen();
    }

    async initializeListeners() {
        // POST REQUESTS
        this.httpClientModuleManager.post(
            '/publish',
            (req, res) => {
                this.publishController.handleHttpApiPublishRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.publishSchema() },
        );

        // this.httpClientModuleManager.post('/provision', (req, res) => {
        //     this.publishController.handleHttpApiProvisionRequest(req, res);
        // });
        //
        // this.httpClientModuleManager.post('/update', (req, res) => {
        //     this.publishController.handleHttpApiUpdateRequest(req, res);
        // });
        //
        // this.httpClientModuleManager.post(HTTP_API_ROUTES.QUERY, (req, res) => {
        //     this.searchController.handleHttpApiQueryRequest(req, res);
        // });
        //
        // this.httpClientModuleManager.post(HTTP_API_ROUTES.PROOFS, (req, res) => {
        //     this.searchController.handleHttpApiProofsRequest(req, res);
        // });
        //
        this.httpClientModuleManager.post(
            '/get',
            (req, res) => {
                this.getController.handleHttpApiGetRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.getSchema() },
        );

        // TODO: Get params validation needs to be implemented
        this.httpClientModuleManager.get(
            '/assertions:search',
            (req, res) => {
                this.searchController.handleHttpApiSearchAssertionsRequest(req, res);
            },
            { rateLimit: true },
        );

        this.httpClientModuleManager.get(
            '/entities:search',
            (req, res) => {
                this.searchController.handleHttpApiSearchEntitiesRequest(req, res);
            },
            { rateLimit: true },
        );

        this.httpClientModuleManager.get('/:operation/:operationId', (req, res) => {
            this.resultController.handleHttpApiOperationResultRequest(req, res);
        });

        this.httpClientModuleManager.get('/info', (req, res) => {
            this.infoController.handleHttpApiInfoRequest(req, res);
        });
    }
}

module.exports = HttpApiRouter;
