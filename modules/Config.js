let instance = null;

class Config {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
}

module.exports = new Config();
