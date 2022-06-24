const pjson = require('../../../package.json');

class InfoController {
    handleHttpApiInfoRequest(req, res) {
        const { version } = pjson;

        res.status(200).send({
            version,
        });
    }
}

module.exports = InfoController;
