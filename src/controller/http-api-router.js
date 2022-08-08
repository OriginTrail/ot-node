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
        this.httpClientModuleManager.post(
            '/publish',
            (req, res) => {
                this.publishController.handleHttpApiPublishRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.publishSchema() },
        );
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

        /* this.httpClientModuleManager.post(
            '/search',
            (req, res) => {
                this.searchController.handleHttpApiSearchRequest(req, res);
            },
            { rateLimit: true, requestSchema: this.jsonSchemaService.searchSchema() },
        ); */

        this.httpClientModuleManager.get('/:operation/:operationId', (req, res) => {
            this.resultController.handleHttpApiOperationResultRequest(req, res);
        });

        this.httpClientModuleManager.get('/info', (req, res) => {
            this.infoController.handleHttpApiInfoRequest(req, res);
        });
    }
}

module.exports = HttpApiRouter;
