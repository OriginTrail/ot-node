let instance = null;

class Storage {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
}

module.exports = new Storage();