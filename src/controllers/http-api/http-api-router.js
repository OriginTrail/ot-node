import stringUtil from '../../service/util/string-util.js';
import { HTTP_API_ROUTES } from '../../constants/constants.js';

class HttpApiRouter {
    constructor(ctx) {
        this.httpClientModuleManager = ctx.httpClientModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.apiRoutes = HTTP_API_ROUTES;
        this.apiVersions = Object.keys(this.apiRoutes);

        this.routers = {};
        for (const version of this.apiVersions) {
            this.routers[version] = this.httpClientModuleManager.createRouterInstance();

            const operations = Object.keys(this.apiRoutes[version]);

            for (const operation of operations) {
                const versionedController = `${stringUtil.toCamelCase(
                    operation,
                )}HttpApiController${stringUtil.capitalize(version)}`;

                this[versionedController] = ctx[versionedController];
            }
        }
        this.routers.latest = this.httpClientModuleManager.createRouterInstance();

        this.jsonSchemaService = ctx.jsonSchemaService;
    }

    async initialize() {
        this.initializeBeforeMiddlewares();
        await this.initializeVersionedListeners();
        this.initializeRouters();
        this.initializeAfterMiddlewares();
        await this.httpClientModuleManager.listen();
    }

    initializeBeforeMiddlewares() {
        const blockchainImplementations = this.blockchainModuleManager.getImplementationNames();
        this.httpClientModuleManager.initializeBeforeMiddlewares(blockchainImplementations);
    }

    async initializeVersionedListeners() {
        const descendingOrderedVersions = this.apiVersions.sort((a, b) => b.localeCompare(a));
        const mountedLatestRoutes = new Set();

        for (const version of descendingOrderedVersions) {
            for (const [name, route] of Object.entries(this.apiRoutes[version])) {
                const { method, path, options } = route;
                const camelRouteName = stringUtil.toCamelCase(name);
                const controller = `${camelRouteName}HttpApiController${stringUtil.capitalize(
                    version,
                )}`;
                const schema = `${camelRouteName}Schema`;

                if (
                    schema in this.jsonSchemaService &&
                    typeof this.jsonSchemaService[schema] === 'function'
                ) {
                    // eslint-disable-next-line no-await-in-loop
                    options.requestSchema = await this.jsonSchemaService[schema](version);
                }

                const middlewares = this.httpClientModuleManager.selectMiddlewares(options);
                const callback = (req, res) => {
                    this[controller].handleRequest(req, res);
                };

                this.routers[version][method](path, ...middlewares, callback);

                if (!mountedLatestRoutes.has(route.name)) {
                    this.routers.latest[method](path, ...middlewares, callback);
                    mountedLatestRoutes.add(route.name);
                }
            }
        }
    }

    initializeRouters() {
        for (const version of this.apiVersions) {
            this.httpClientModuleManager.use(`/${version}`, this.routers[version]);
        }

        this.httpClientModuleManager.use('/latest', this.routers.latest);
        this.httpClientModuleManager.use('/', this.routers.v0);
    }

    initializeAfterMiddlewares() {
        this.httpClientModuleManager.initializeAfterMiddlewares();
    }
}

export default HttpApiRouter;
