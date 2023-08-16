import stringUtil from '../../service/util/string-util.js';
import { HTTP_API_ROUTES } from '../../constants/constants.js';

class HttpApiRouter {
    constructor(ctx) {
        this.config = ctx.config;
        this.httpClientModuleManager = ctx.httpClientModuleManager;

        this.apiRoutes = HTTP_API_ROUTES;
        this.apiVersions = Object.keys(this.apiRoutes);

        this.routers = {};
        for (const version of this.apiVersions) {
            this.routers[version] = this.httpClientModuleManager.createRouterInstance();

            const operations = this.apiRoutes[version].map((route) => route.name);

            for (const operation of operations) {
                const versionedOperation = `${stringUtil.toCamelCase(
                    operation,
                )}HttpApiController${stringUtil.capitalize(version)}`;
                this[versionedOperation] = ctx[versionedOperation];
            }
        }
        this.routers.latest = this.httpClientModuleManager.createRouterInstance();

        this.blockchainModuleManager = ctx.blockchainModuleManager;
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
        this.httpClientModuleManager.initializeBeforeMiddlewares();
    }

    async initializeVersionedListeners() {
        const descendingOrderedVersions = this.apiVersions.sort((a, b) => b.localeCompare(a));
        const mountedLatestRoutes = new Set();

        for (const version of descendingOrderedVersions) {
            for (const route of this.apiRoutes[version]) {
                const { method, path, controller, options } = route;

                if (options.schema) {
                    const argumentsObject = {};

                    for (const [argName, argFuncRef] of Object.entries(options.schema.args)) {
                        // eslint-disable-next-line no-await-in-loop
                        argumentsObject[argName] = await this._executeFunctionFromConfigRef(
                            this,
                            argFuncRef,
                        );
                    }

                    // eslint-disable-next-line no-await-in-loop
                    options.requestSchema = await this.jsonSchemaService[options.schema.name](
                        version,
                        argumentsObject,
                    );
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

    async _executeFunctionFromConfigRef(context, reference) {
        const parts = reference.split('.');
        const fnName = parts.pop();
        const objRef = parts.reduce((acc, part) => acc[part], context);

        if (objRef && typeof objRef[fnName] === 'function') {
            const result = objRef[fnName]();

            if (result instanceof Promise) {
                // eslint-disable-next-line no-return-await
                return await result;
            }

            return result;
        }

        throw new Error(`Function ${reference} not found.`);
    }
}

export default HttpApiRouter;
