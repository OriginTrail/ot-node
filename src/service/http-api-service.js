import fs from 'fs';
import path from 'path';
import stringUtil from './util/string-util.js';

class HttpApiService {
    constructor(ctx) {
        this.fileService = ctx.fileService;
    }

    getApiVersions(sort = false) {
        const httpControllersPath = this.fileService.getHttpControllersFolderPath();
        const versions = fs.readdirSync(httpControllersPath).filter((folder) => {
            if (!fs.statSync(path.join(httpControllersPath, folder)).isDirectory()) return false;
            if (folder === 'old') return true;
            return /^v\d+$/.test(folder);
        });

        if (sort) {
            return versions.sort((a, b) => {
                if (a === 'old') return 1;
                if (b === 'old') return -1;

                return parseInt(b.substring(1), 10) - parseInt(a.substring(1), 10);
            });
        }

        return versions;
    }

    getAvailableOperations(version, camelCase = false) {
        const versionFolder = path.join(this.fileService.getHttpControllersFolderPath(), version);

        const operations = [];
        for (const controller of fs.readdirSync(versionFolder)) {
            let operation;

            if (!controller.endsWith(`-http-api-controller-${version}.js`)) {
                continue;
            } else {
                operation = controller.replace(`-http-api-controller-${version}.js`, '');
            }

            if (camelCase) {
                operations.push(stringUtil.toCamelCase(operation));
            } else {
                operations.push(operation);
            }
        }

        return operations;
    }
}

export default HttpApiService;
