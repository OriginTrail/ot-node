const pjson = require('../../../package.json');
const BaseController = require('./base-controller');

class InfoController extends BaseController {
    handleHttpApiInfoRequest(req, res) {
        const { version } = pjson;
        this.returnResponse(res, 200, {
            version,
        });
    }
}

module.exports = InfoController;
