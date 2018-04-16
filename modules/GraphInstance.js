let instance = null;

class GraphInstance {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
}

module.exports = new GraphInstance();
