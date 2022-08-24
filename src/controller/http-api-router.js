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
        await this.initializeBeforeMiddlewares();
        await this.initializeListeners();
        await this.initializeAfterMiddlewares();
        await this.httpClientModuleManager.listen();
    }

    async initializeListeners() {
        this.httpClientModuleManager.post(
            '/publish',
            (req, res) => {
                this.publishController.handleHttpApiPublishRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.publishSchema() },
        );

        this.httpClientModuleManager.post(
            '/query',
            (req, res) => {
                this.searchController.handleHttpApiQueryRequest(req, res);
            },
            { rateLimit: true, requestSchema: queryRequestSchema },
        );

        this.httpClientModuleManager.post(
            '/get',
            (req, res) => {
                this.getController.handleHttpApiGetRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.getSchema() },
        );

        this.httpClientModuleManager.get('/:operation/:operationId', (req, res) => {
            this.resultController.handleHttpApiOperationResultRequest(req, res);
        });

        this.httpClientModuleManager.get('/info', (req, res) => {
            this.infoController.handleHttpApiInfoRequest(req, res);
        });
    }

    async initializeBeforeMiddlewares() {
        await this.httpClientModuleManager.initializeBeforeMiddlewares();
    }

    async initializeAfterMiddlewares() {
        await this.httpClientModuleManager.initializeAfterMiddlewares();
    }
}

module.exports = HttpApiRouter;
