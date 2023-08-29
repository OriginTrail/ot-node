import express from 'express';

class HttpClientModuleManagerMock {
    createRouterInstance() {
        return express.Router();
    }

    initializeBeforeMiddlewares() {}

    async listen() {}

    use(path, callback) {}

    selectMiddlewares(options) {
        return [];
    }

    initializeAfterMiddlewares() {}
}

export default HttpClientModuleManagerMock;
