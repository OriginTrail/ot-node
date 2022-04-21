const ExpressHttpClient = require('./implementation/express-http-client');

class HttpClientModuleInterface {
    initialize(config) {
        // if config.module.express
        this.instance = new ExpressHttpClient();
        this.instance.initialize();
    }

    get(route, ...callback) {
        return this.instance.get(route, callback);
    }

    post(route, ...callback) {
        return this.instance.post(route, callback);
    }

    sendResponse(res, status, returnObject) {
        return this.instance.sendResponse(res, status, returnObject);
    }
}

module.exports = HttpClientModuleInterface;
