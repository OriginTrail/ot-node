import fs from 'fs';
import path from 'path';
import BaseModuleManager from '../base-module-manager.js';
import stringUtil from '../../service/util/string-util.js';

class HttpClientModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.authService = ctx.authService;
        this.fileService = ctx.fileService;
    }

    getName() {
        return 'httpClient';
    }

    getApiVersions() {
        const httpControllersPath = this.fileService.getHttpControllersFolderPath();
        return fs
            .readdirSync(httpControllersPath)
            .filter((folder) => fs.statSync(path.join(httpControllersPath, folder)).isDirectory());
    }

    getMethodControllers(version, camelCase = true) {
        const versionFolder = path.join(this.fileService.getHttpControllersFolderPath(), version);

        const methodControllers = [];
        for (const controller of fs.readdirSync(versionFolder)) {
            if (!controller.endsWith(`-http-api-controller-${version}.js`)) continue;

            if (camelCase) {
                methodControllers.push(stringUtil.toCamelCase(controller.replace('.js', '')));
            } else {
                methodControllers.push(controller.replace('.js', ''));
            }
        }

        return methodControllers;
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
