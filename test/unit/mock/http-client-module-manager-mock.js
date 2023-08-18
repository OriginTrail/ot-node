import express from 'express';

class HttpClientModuleManagerMock {
    createRouterInstance() {
        return express.Router();
    }

    initializeBeforeMiddlewares() {}

    async listen() {}

    use(path, callback) {}

    get() {}

    post() {}

    selectMiddlewares(options) {
        return [];
    }

    initializeAfterMiddlewares() {}
}

export default HttpClientModuleManagerMock;
