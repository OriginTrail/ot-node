const BaseModuleManager = require('../base-module-manager');

class HttpClientModuleManager extends BaseModuleManager {
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

    async initializeMiddleware() {
        if (this.initialized) {
            return this.getImplementation().module.initializeMiddleware();
        }
    }
}

module.exports = HttpClientModuleManager;
