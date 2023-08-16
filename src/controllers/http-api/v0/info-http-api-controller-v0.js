import { createRequire } from 'module';
import BaseController from '../base-http-api-controller.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../../package.json');

class InfoController extends BaseController {
    handleRequest(_, res) {
        this.returnResponse(res, 200, {
            version,
        });
    }
}

export default InfoController;
