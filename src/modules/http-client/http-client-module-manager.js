const BaseModuleManager = require('../base-module-manager');

class HttpClientModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.authService = ctx.authService;
    }

    getName() {
        return 'httpClient';
    }

    get(route, ...callback) {
        if (this.initialized) {
            return this.getImplementation().module.get(route, ...callback);
        }
    }

    post(route, requestSchema, ...callback) {
        if (this.initialized) {
            return this.getImplementation().module.post(route, requestSchema, ...callback);
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

    async initializeBeforeMiddlewares() {
        if (this.initialized) {
            return this.getImplementation().module.initializeBeforeMiddlewares(this.authService);
        }
    }

    async initializeAfterMiddlewares() {
        if (this.initialized) {
            return this.getImplementation().module.initializeAfterMiddlewares(this.authService);
        }
    }
}

module.exports = HttpClientModuleManager;
