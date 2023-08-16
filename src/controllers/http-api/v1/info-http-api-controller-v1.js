import { createRequire } from 'module';
import BaseController from '../base-http-api-controller.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../../package.json');

class InfoControllerV1 extends BaseController {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    handleRequest(_, res) {
        this.returnResponse(res, 200, {
            version,
            ...this.filterConfig(),
        });
    }

    filterConfig() {
        const nodeConfigData = {
            tripleStores: Object.entries(this.config.modules.tripleStore.implementation)
                .filter(([, value]) => value.enabled)
                .map(([key]) => key),
            blockchains: this.blockchainModuleManager.getImplementationNames(),
        };

        return nodeConfigData;
    }
}

export default InfoControllerV1;
