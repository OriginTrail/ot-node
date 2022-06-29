const BaseModuleManager = require('../base-module-manager');

class HttpClientModuleManager extends BaseModuleManager {
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
}

module.exports = HttpClientModuleManager;
