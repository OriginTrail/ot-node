let instance = null;

class BlockChainInstance {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
}

module.exports = new BlockChainInstance();
