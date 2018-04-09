let instance = null;

class GraphStorageInstance {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
}

module.exports = new GraphStorageInstance();
