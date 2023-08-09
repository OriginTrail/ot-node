import stringUtil from '../../service/util/string-util.js';

class HttpApiRouter {
    constructor(ctx) {
        this.config = ctx.config;
        this.httpClientModuleManager = ctx.httpClientModuleManager;

        const versions = this.httpClientModuleManager.getApiVersions();

        for (const version of versions) {
            const versionedMethodControllers =
                this.httpClientModuleManager.getMethodControllers(version);

            for (const versionedController of versionedMethodControllers) {
                this[versionedController] = ctx[versionedController];
            }
        }

        this.jsonSchemaService = ctx.jsonSchemaService;
    }

    async initialize() {
        this.initializeBeforeMiddlewares();
        await this.initializeListeners();
        this.initializeAfterMiddlewares();
        await this.httpClientModuleManager.listen();
    }

    async initializeListeners() {
        await this.initializeVersionedListeners('v1');
        await this.initializeOldListeners();
    }

    async initializeOldListeners() {
        this.httpClientModuleManager.post(
            '/publish',
            (req, res) => {
                this.publishHttpApiControllerOld.handlePublishRequest(req, res);
            },
            { rateLimit: true, requestSchema: await this.jsonSchemaService.publishSchema('old') },
        );

        this.httpClientModuleManager.post(
            '/update',
            (req, res) => {
                this.updateHttpApiControllerOld.handleUpdateRequest(req, res);
            },
            { rateLimit: true, requestSchema: await this.jsonSchemaService.updateSchema('old') },
        );

        this.httpClientModuleManager.post(
            '/query',
            (req, res) => {
                this.queryHttpApiControllerOld.handleQueryRequest(req, res);
            },
            { requestSchema: await this.jsonSchemaService.querySchema('old') },
        );

        this.httpClientModuleManager.post(
            '/local-store',
            (req, res) => {
                this.localHttpApiControllerOld.handleLocalStoreRequest(req, res);
            },
            { requestSchema: await this.jsonSchemaService.localStoreSchema('old') },
        );

        this.httpClientModuleManager.post(
            '/get',
            (req, res) => {
                this.getHttpApiControllerOld.handleGetRequest(req, res);
            },
            { rateLimit: true, requestSchema: await this.jsonSchemaService.getSchema('old') },
        );

        this.httpClientModuleManager.get('/:operation/:operationId', (req, res) => {
            this.resultHttpApiControllerOld.handleOperationResultRequest(req, res);
        });

        this.httpClientModuleManager.get('/info', (req, res) => {
            this.infoHttpApiControllerOld.handleInfoRequest(req, res);
        });

        this.httpClientModuleManager.get(
            '/bid-suggestion',
            (req, res) => {
                this.bidSuggestionHttpApiControllerOld.handleBidSuggestionRequest(req, res);
            },
            { requestSchema: await this.jsonSchemaService.bidSuggestionSchema('old') },
        );
    }

    async initializeVersionedListeners(version) {
        this.httpClientModuleManager.get(`/${version}/info`, (req, res) => {
            this[`infoHttpApiController${stringUtil.capitalize(version)}`].handleInfoRequest(
                req,
                res,
            );
        });
    }

    initializeBeforeMiddlewares() {
        this.httpClientModuleManager.initializeBeforeMiddlewares();
    }

    initializeAfterMiddlewares() {
        this.httpClientModuleManager.initializeAfterMiddlewares();
    }
}

export default HttpApiRouter;
