const BaseModuleInterface = require('../base-module-interface');

class HttpClientModuleInterface extends BaseModuleInterface {
    getName() {
        return 'httpClient';
    }

    get(route, ...callback) {
        if (this.initialized) {
            return this.handlers[0].module.get(route, ...callback);
        }
    }

    post(route, ...callback) {
        if (this.initialized) {
            return this.handlers[0].module.post(route, ...callback);
        }
    }

    sendResponse(res, status, returnObject) {
        if (this.initialized) {
            return this.handlers[0].module.sendResponse(res, status, returnObject);
        }
    }
}

module.exports = HttpClientModuleInterface;
