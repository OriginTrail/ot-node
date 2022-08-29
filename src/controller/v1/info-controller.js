/* eslint-disable import/extensions */
import pjson from '../../../package.json' assert { type: 'json' };
import BaseController from './base-controller.js';

class InfoController extends BaseController {
    handleHttpApiInfoRequest(req, res) {
        const { version } = pjson;
        this.returnResponse(res, 200, {
            version,
        });
    }
}

export default InfoController;
