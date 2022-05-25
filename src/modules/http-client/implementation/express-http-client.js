const express = require('express');

class ExpressHttpClient {
    async initialize() {
        this.app = express();
    }

    async get(route, ...callback) {
        this.app.get(route, callback);
    }

    async post(route, ...callback) {
        this.app.post(route, callback);
    }

    sendResponse(res, status, returnObject) {
        res.status(status);
        res.send(returnObject);
    }
}

module.exports = ExpressHttpClient;
