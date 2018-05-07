const CT = require('@kadenceproject/kadence').Control;
const config = require('./Config');

class Control extends CT {
    getConfigParams(callback) {
        if (!config) {
            callback('Unable to read config');
        }
        callback(null, config);
    }
}

module.exports = Control;
