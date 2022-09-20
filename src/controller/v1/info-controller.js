import { createRequire } from 'module';
import BaseController from './base-controller.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json');

class InfoController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.networkModuleManager = ctx.networkModuleManager;
    }

    handleHttpApiInfoRequest(req, res) {
        this.returnResponse(res, 200, {
            version,
            multiAddresses: this.networkModuleManager.getMultiAddrs(),
        });
    }
}

export default InfoController;
