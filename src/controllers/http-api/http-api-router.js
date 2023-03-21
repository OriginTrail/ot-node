class HttpApiRouter {
    constructor(ctx) {
        this.config = ctx.config;
        this.httpClientModuleManager = ctx.httpClientModuleManager;

        this.getHttpApiController = ctx.getHttpApiController;
        this.publishHttpApiController = ctx.publishHttpApiController;
        this.updateHttpApiController = ctx.updateHttpApiController;
        this.localStoreHttpApiController = ctx.localStoreHttpApiController;
        this.queryHttpApiController = ctx.queryHttpApiController;
        this.resultHttpApiController = ctx.resultHttpApiController;
        this.infoHttpApiController = ctx.infoHttpApiController;
        this.bidSuggestionHttpApiController = ctx.bidSuggestionHttpApiController;

        this.jsonSchemaService = ctx.jsonSchemaService;
    }

    async initialize() {
        this.initializeBeforeMiddlewares();
        this.initializeListeners();
        this.initializeAfterMiddlewares();
        await this.httpClientModuleManager.listen();
    }

    initializeListeners() {
        this.httpClientModuleManager.post(
            '/publish',
            (req, res) => {
                this.publishHttpApiController.handlePublishRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.publishSchema() },
        );

        this.httpClientModuleManager.post(
            '/update',
            (req, res) => {
                this.updateHttpApiController.handleUpdateRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.updateSchema() },
        );

        this.httpClientModuleManager.post(
            '/query',
            (req, res) => {
                this.queryHttpApiController.handleQueryRequest(req, res);
            },
            { requestSchema: this.jsonSchemaService.querySchema() },
        );

        this.httpClientModuleManager.post(
            '/local-store',
            (req, res) => {
                this.localStoreHttpApiController.handleLocalStoreRequest(req, res);
            },
            { requestSchema: this.jsonSchemaService.localStoreSchema() },
        );

        this.httpClientModuleManager.post(
            '/get',
            (req, res) => {
                this.getHttpApiController.handleGetRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.getSchema() },
        );

        this.httpClientModuleManager.get('/:operation/:operationId', (req, res) => {
            this.resultHttpApiController.handleOperationResultRequest(req, res);
        });

        this.httpClientModuleManager.get('/info', (req, res) => {
            this.infoHttpApiController.handleInfoRequest(req, res);
        });

        this.httpClientModuleManager.get(
            '/bid-suggestion',
            (req, res) => {
                this.bidSuggestionHttpApiController.handleBidSuggestionRequest(req, res);
            },
            { requestSchema: this.jsonSchemaService.bidSuggestionSchema() },
        );
    }

    initializeBeforeMiddlewares() {
        this.httpClientModuleManager.initializeBeforeMiddlewares();
    }

    initializeAfterMiddlewares() {
        this.httpClientModuleManager.initializeAfterMiddlewares();
    }
}

export default HttpApiRouter;
