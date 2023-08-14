import BaseModuleManager from '../base-module-manager.js';

class HttpClientModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.authService = ctx.authService;
        this.fileService = ctx.fileService;
    }

    getName() {
        return 'httpClient';
    }

    get(route, callback, options = {}) {
        if (this.initialized) {
            return this.getImplementation().module.get(route, callback, options);
        }
    }

    post(route, callback, options = {}) {
        if (this.initialized) {
            return this.getImplementation().module.post(route, callback, options);
        }
    }

    use(route, callback, options) {
        if (this.initialized) {
            return this.getImplementation().module.use(route, callback, options);
        }
    }

    createRouterInstance() {
        if (this.initialized) {
            return this.getImplementation().module.createRouterInstance();
        }
    }

    sendResponse(res, status, returnObject) {
        if (this.initialized) {
            return this.getImplementation().module.sendResponse(res, status, returnObject);
        }
    }

    async listen() {
        if (this.initialized) {
            return this.getImplementation().module.listen();
        }
    }

    initializeBeforeMiddlewares() {
        if (this.initialized) {
            return this.getImplementation().module.initializeBeforeMiddlewares(this.authService);
        }
    }

    initializeAfterMiddlewares() {
        if (this.initialized) {
            return this.getImplementation().module.initializeAfterMiddlewares(this.authService);
        }
    }
}

export default HttpClientModuleManager;
