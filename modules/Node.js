let instance = null;

class Node {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
}

module.exports = new Node();
