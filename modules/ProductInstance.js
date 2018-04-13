let instance = null;

class ProductInstance {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
}

module.exports = new ProductInstance();
