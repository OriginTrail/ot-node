class HttpApiRouter {
    constructor(ctx) {
        this.config = ctx.config;
        this.httpClientModuleManager = ctx.httpClientModuleManager;

        this.getHttpApiController = ctx.getHttpApiController;
        this.publishHttpApiController = ctx.publishHttpApiController;
        this.searchHttpApiController = ctx.searchHttpApiController;
        this.resultHttpApiController = ctx.resultHttpApiController;
        this.infoHttpApiController = ctx.infoHttpApiController;

        this.jsonSchemaService = ctx.jsonSchemaService;
    }

    async initialize() {
        await this.initializeBeforeMiddlewares();
        await this.initializeListeners();
        await this.initializeAfterMiddlewares();
        await this.httpClientModuleManager.listen();
    }

    async initializeListeners() {
        this.httpClientModuleManager.post(
            '/publish',
            (req, res) => {
                this.publishHttpApiController.handlePublishRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.publishSchema() },
        );

        this.httpClientModuleManager.post(
            '/query',
            (req, res) => {
                this.searchHttpApiController.handleQueryRequest(req, res);
            },
            { requestSchema: this.jsonSchemaService.querySchema() },
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
    }

    async initializeBeforeMiddlewares() {
        await this.httpClientModuleManager.initializeBeforeMiddlewares();
    }

    async initializeAfterMiddlewares() {
        await this.httpClientModuleManager.initializeAfterMiddlewares();
    }
}

export default HttpApiRouter;
