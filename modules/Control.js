const CT = require('@deadcanaries/kadence').Control;

class Control extends CT {
    constructor(node, config) {
        super(node);
        this.config = config;
    }
    getConfigParams(callback) {
        if (!this.config) {
            callback('Unable to read config');
        }
        callback(null, this.config);
    }
}

module.exports = Control;
